let path = require('path')
let fs = require('fs')

let util = require('./util')
let UglifyJS = require("uglify-js")
var CleanCSS = require('clean-css')

let g_conf = global.g_conf
let tmpDir = g_conf.tmpDir
let releaseConf = g_conf.yypackJSON.release
let gCase = g_conf.case

let fromDir = gCase.optimize? tmpDir.d : tmpDir.c
let toDir = releaseConf.project ? path.join(gCase.www, releaseConf.project) : gCase.www

//版本对应表
let vtable = {}
//依赖表
let dtable = {}
//script|css|img
let reg1 = /(?:<script.*?src="(.*?)".*?>\s*<\/script>)|(?:<link.*?href="(.*?)".*?>)|(?:<img.*?src="(.*?)".*?>)|(?:script\(.*?src="(.*?)".*?\))|(?:link\(.*?href="(.*?)".*?\))|(?:img\(.*?src="(.*?)".*?\))/gi
//url()
let reg2 = /url\(['"]?(?!http:\/\/)([^)'"]+)/gi
//img
let reg3 = /<img.*?src="(.*?)".*?>/gi

//插入依赖表
function idtable(a, b){
    if (! (a in dtable)){
        dtable[a] = [b]
    }
    else {
        if (dtable[a].indexOf(b) == -1){
            dtable[a].push(b)
        }
    }
}

//f1当前文件，f2引用文件
function gPath(f1, f2){
    let f3 = {
        path: null,
        content: null
    }

    if (f2.slice(0,4) == 'http'){
        return f3
    }

    if (f2[0] == '/'){
        f3.path = path.join(fromDir, f2)
    }
    else {
        f3.path = path.join(path.dirname(f1), f2)
    }

    //如果不在d中
    if (!fs.existsSync(f3.path)){
        //检查是否在www中
        let f4 = path.join(g_conf.case.www, releaseConf.project, f2)

        if (!fs.existsSync(f4)){
            f3.path = null
        }
        else {
            f3.content = util.getBody(f4)
        }
    }

    return f3
}

function v(t){
    //先其他类型
    let ps = []
    t.other.forEach(_=>{
        ps.push(v1(_))
    })

    return Promise.all(ps).then(_=>{
        //再css
        t.css.forEach(_=>{
            v2(_)
        })
        //最后html
        t.html.forEach(_=>{
            v3(_)
        })
    })
}

//替换引用辅助函数
function vf(f, a, b){
    let pathObj = gPath(f, b)
    let bf = pathObj.path

    if (bf !== null){
        idtable(bf, f)

        //如果script inline
        if (/<script.*?inline.*?>/i.test(a)){
            return `<script>${pathObj.content || v2(bf)}</script>`
        }
        //如果css inline
        if (/<link.*?inline.*?>/i.test(a)){
            return `<style type="text/css">${pathObj.content || v2(bf)}</style>`
        }

        // jade script|css
        if (/^(script|link)\(.*?inline/i.test(a)) {
            var content = pathObj.content || v2(bf),
                tag = a.split('(')[0]

            // 如果 jade inline，则对内容压缩，避免缩进问题
            if (tag == 'link') {
                tag = 'style'
                content = (new CleanCSS()).minify(content).styles
            }
            else {
                content = UglifyJS.minify(content, {fromString:true, output:{'ascii_only':true}}).code
            }

            return `${tag} ${content}`
        }

        let bo = path.parse(bf)

        let domain = gCase.domain ? releaseConf.domain : ''
        let project = releaseConf.project ? releaseConf.project : ''
        let version = gCase.version && vtable[bf] ? `.${vtable[bf]}` : ''

        return a.replace(b, domain + '/' + path.join(project, bo.dir.replace(fromDir, ''), `${bo.name}${version}${bo.ext}`).replace(/\\/g,'/'))
    }
    else {
        return a
    }
}

//处理非html,css文件
function v1(f){
    util.log(`[path]: ${path.relative(fromDir, f)}`)

    let fo = path.parse(f)
    let f2 = path.join(toDir, path.relative(fromDir, f))

    let v = ''
    if (gCase.version){
        v = util.getMd5(util.getBody(f))
        vtable[f] = v
        v = `.${v}`
    }

    f2 = path.join(path.dirname(f2), `${fo.name}${v}${fo.ext}`)
    return util.copy(f, f2)
}
//处理js,css文件
function v2(f){
    util.log(`[path]: ${path.relative(fromDir, f)}`)

    let fo = path.parse(f)
    let f2 = path.join(toDir, path.relative(fromDir, f))

    let reg = (fo.ext == '.css') ? reg2 : reg3

    let body = util.getBody(f).replace(reg, (a, b)=>{
        if (b){
            return vf(f, a, b)
        }
        else {
            return a
        }
    })

    let v = ''
    if (gCase.version){
        v = util.getMd5(body)
        vtable[f] = v
        v = `.${v}`
    }

    util.createF(path.join(path.dirname(f2), `${fo.name}${v}${fo.ext}`), body)
    return body
}
//处理html文件
function v3(f){
    util.log(`[path]: ${path.relative(fromDir, f)}`)

    let fo = path.parse(f)
    let rf = path.relative(fromDir, f)
    let f2 = path.join(toDir, rf)

    let body = util.getBody(f).replace(reg1, (a, ...args) => {
        b = args.filter(v => !!v)[0]
        if (b){
            return vf(f, a, b)
        }
        else {
            return a
        }
    })

    let v = ''
    let isStatic = rf.split('/')[0] == 'static' || rf.split('\\')[0] == 'static'
    if (gCase.htmlVersion && isStatic){
        v = gCase.env.htmlVersion
    }

    if(fs.existsSync(f2) && util.isDir(f2)){
        util.walk(path.dirname(f2), f=>{
            if(path.parse(f).ext == '.html'){
                fs.unlink(f)
            }
        })
    }
    util.createF(path.join(path.dirname(f2), `${fo.name}${v}${fo.ext}`), body)
}

function isHtml(ext){
    return ['.html', '.vm', '.jade'].indexOf(ext) != -1
}

function iftable(f, ftable){
    let fo = path.parse(f)
    let ext = fo.ext

    if (isHtml(ext)){
        ftable.html.push(f)
    }
    else if (ext == '.css' || ext == '.js'){
        ftable.css.push(f)
    }
    else {
        ftable.other.push(f)
    }
}

//递归查询依赖
function findDep(f, ftable){
    iftable(f, ftable)

    let deps = dtable[f]
    if (!deps || deps.length == 0){
        return false
    }

    deps.forEach(_=>{
        findDep(_, ftable)
    })
}

function version(){
    //得到文件表
    let ftable = {html:[], css:[], other:[]}

    util.walk(fromDir, f=>{
        iftable(f, ftable)
    })

    return v(ftable)
}

function watch(){
    util.watch(fromDir, (event, f)=>{
        f = path.join(fromDir, f)

        if (!fs.existsSync(f) || util.isDir(f)){
            return
        }

        let ftable = {html:[], css:[], other:[]}
        findDep(f, ftable)

        v(ftable)
    })
}

exports.version = version
exports.watch = watch
