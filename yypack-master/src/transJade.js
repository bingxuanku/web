let path = require('path')
let fs = require('fs')
let exec = require('child_process').exec
let colors = require('colors')
let deepAssign = require('deep-assign')
let util = require('./util')
var jade = require('jade')

let g_conf = global.g_conf
let tmpDir = g_conf.tmpDir
let releaseConf = g_conf.yypackJSON.release

let isWatch = g_conf.case.watch

// 增加jadeData支持
let injectJadeDataDir = path.join(tmpDir.a, g_conf.case.jadeDataDir)

//* 依赖表
let depTable = {}
let reg = /(?:include|extends)\s+(.*?)\s*$/gm

function insertDepTable(childF, mainF){
    if (! (childF in depTable)){
        depTable[childF] = [mainF]
    }
    else {
        if (depTable[childF].indexOf(mainF) == -1){
            depTable[childF].push(mainF)
        }
    }
}

// mockjs require 解析依赖
function insertDepTableByModule(m, rf) {
    // m.id 当前文件
    // m.children 引用的module
    m.children.forEach(sub => {
        insertDepTable(path.relative(tmpDir.a, sub.id), rf)

        if (sub.children.length) {
            insertDepTableByModule(sub, rf)
        }
    })
}
function clearCachedModule(moduleId) {
    if (!require.cache[moduleId]) {
        return
    }

    var m = require.cache[moduleId]
    if (m.children && m.children.length) {
        m.children.forEach(sub => clearCachedModule(sub.id))
    }

    delete require.cache[m.id]
}

function scanF(f){
    if (!fs.existsSync(f)){
        return
    }

    let body = util.getBody(f)

    let dfs = [], v
    while ( null != (v = reg.exec(body)) ){
        let df = path.join(path.dirname(f), v[1])
        if (path.extname(df) == ''){
            df = `${df}.jade`
        }

        insertDepTable(path.relative(tmpDir.a, df), f)
        dfs.push(df)
    }

    dfs.forEach(_=>{
        scanF(_)
    })
}

function isJade(f){
    return path.extname(f) == '.jade'
}

function transJade(f){
    if (!fs.existsSync(f) || !isJade(f)){
        return
    }

    let rf = path.relative(tmpDir.a, f)

    // 忽略 page/_*
    if (rf.startsWith('page') && path.basename(rf)[0] == '_') {
        return
    }

    let body = ''
    let f2

    try{
        // 增加jadeData支持
        let data = {
            FEDOG: g_conf.case.env,
            FEPACK: g_conf.case.env,
            YYPACK: g_conf.case.env
        }

        if (
            // 只考虑page下文件
            rf.startsWith('page' + path.sep)
        ) {
           let dataFile = path.join(
                injectJadeDataDir,
                path.relative('page' + path.sep, path.dirname(rf)),
                path.basename(rf, '.jade') + '.js'
            )

            // 数据文件是否存在
            if (fs.existsSync(dataFile)) {
                jadeData = require(dataFile)

                try {
                    data = deepAssign(jadeData, data)

                    insertDepTableByModule(require.cache[dataFile], rf)
                    insertDepTable(path.relative(tmpDir.a, dataFile), rf)

                    // 清除require缓存
                    // node目前不会将缓存的module加入children，也需要清理
                    clearCachedModule(dataFile)
                }
                catch(ex) {
                    util.error(ex)
                }
            }
        }

        body = jade.compileFile(f, {pretty:true, doctype:'html'})(data)
    }
    catch(ex){
        util.error(ex)
    }

    util.log(`[translate]: ${rf}`)

    // 用jade来写(tpl|vm|..)文件的方式
    if (/\.\w+?\.jade$/.test(rf)){
        f2 = path.join(tmpDir.b, rf.slice(0, -5))
    }
    else {
        f2 = path.join(tmpDir.b, rf.slice(0, -5) + '.html')
    }

    util.createF(f2, body)
    scanF(f)
}

function translate(){
    util.walk(tmpDir.a, f => {
        transJade(f)
    })
}

function watch(){
    util.watch(tmpDir.a, (e, rf)=>{
        // if (!isJade(rf)){
        if (!util.isext(rf, '.jade,.js')){
            return false
        }

        let f = path.join(tmpDir.a, rf)

        // 不再检测下划线开头的私有文件，因为可能在编译的下阶段被js引用
        if (rf in depTable){
            depTable[rf].forEach(_=>{
                transJade(_)
            })
        }
        transJade(f)
    })
}

exports.translate = translate
exports.watch = watch
