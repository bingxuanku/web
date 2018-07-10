let path = require('path')
let fs = require('fs')
let os = require('os')
let program = require('commander')
let exec = require('child_process').exec
let colors = require('colors')
let deepAssign = require('deep-assign')
let util = require('./src/util')
let scaffold = require('./scaffold/scaffold')

function main(){
    program
        .version('1.2.6')
        .option('init', 'fepack to yypack', _=>{
            createConfig()
        })
        .option('server [s]', 'a static server', _=>{
            initConfig()
            let server = require('./src/server/server')
            server[_]()
        })
        .option('release [r]', 'release project', _=>{
            program.releaseCase = _
            initConfig()
            factory()
        })
        .option('create [p]', 'create project', _=>{
            scaffold.create(_)
        })
        .parse(process.argv)
}

function createConfig(){
    let root = process.cwd()
    let conf1 = path.join(root, 'yypack.json')
    let conf2 = path.join(root, 'fepack.json')
    let conf3 = path.join(root, 'run.py')
    let conf4 = path.join(root, '.gitignore')

    if(fs.existsSync(conf2)){
        fs.rename(conf2,conf1, _=>{
            if (!_) {
                util.log('fepack文件名转换成功');
            }
        })
    }

    if(fs.existsSync(conf3)){
        fs.unlinkSync(conf3)
    }
    util.createF(conf3,util.getBody(path.join(__dirname,'/scaffold/template/run.py')))
    util.log('run.py更新成功')


    if(fs.existsSync(conf4)){
        fs.unlinkSync(conf4)
    }
    util.createF(conf4,util.getBody(path.join(__dirname,'/scaffold/template/gitignore.txt')))
    util.log('.gitignore更新成功')
}

function initConfig(){
    let root = process.cwd()
    let tmp = '__yypack-tmp'

    let g_conf = global.g_conf = {
        root: root,
        tmp: tmp,
        tmpDir: {},
        yypackJSON: {},
        case: {}
    }

    //* 构造临时目录路径
    'abcd'.split('').forEach(_ => {
        let p = path.join(root, tmp, _)
        g_conf.tmpDir[_] = p
    })

    //* 读取yypack配置文件
    let yypackFile = path.join(root, 'yypack.json')
    if (!fs.existsSync(yypackFile)){
        util.error(`Can not find "yypack.json", please check!`)
        process.exit()
    }

    let yypackJSON = JSON.parse(util.getBody(yypackFile))
    g_conf.yypackJSON = deepAssign({
        server: {port: 8080},
        release: {
            project: '',
            domain: '',
            cases: {},
            copy: [],
            igonre: [],
            externals: {},
            postcss: {}
        }
    }, yypackJSON)

    let home = process.env.HOME || process.env.USERPROFILE
    g_conf.case = deepAssign({
        optimize: false,
        version: false,
        watch: false,
        domain: false,
        reDomain: '',
        www: path.join(home, '.yypack-tmp/www'),
        env: {},
        jadeDataDir: 'mock',
        jadeKeep: false
    }, g_conf.yypackJSON.release.cases[program.releaseCase] || {})

    if (g_conf.case.www[0] != '/' && !g_conf.case.www.match(/\\/g)){
        g_conf.case.www = path.join(root, g_conf.case.www)
    }

    if (g_conf.case.reDomain){
        g_conf.yypackJSON.release.domain = g_conf.case.reDomain
    }

    //在环境变量中增加html版本号
    g_conf.case.env['htmlVersion'] = g_conf.case.htmlVersion ? +new Date : ''

    // jadeKeep 如果开启强制开启 optimize
    // if (g_conf.case.jadeKeep && !g_conf.case.optimize) {
    //     g_conf.case.optimize = true
    // }

    //* 设置cmd title
    process.stdout.write(`${String.fromCharCode(27)}]0;YYPACK [${g_conf.yypackJSON.release.project}]${String.fromCharCode(7)}`)
}

function cleanTmpDir(){
    return new Promise((resolve, reject) => {
        if(os.type().match(/Windows/i)){
            console.log("win")
            let f = path.join(g_conf.root, g_conf.tmp)
            util.delDir(f)
            resolve()
        }else{
            console.log("mac")
            exec(`rm -rf ${path.join(g_conf.root, g_conf.tmp)}`).stdout.on('end', _=>{
                resolve()
            })
        } 
    })
}

function createTmpDir(){
    for (let k in g_conf.tmpDir){
        util.createF(g_conf.tmpDir[k])
    }
    return Promise.resolve()
}

function factory(){
    let gCase = g_conf.case
    let filter = require('./src/filter')
    let translate = require('./src/translate')
    let jsRequire = require('./src/jsRequire')
    let optimize = require('./src/optimize')
    let version = require('./src/version')

    cleanTmpDir()
        .then(_ => {
            return createTmpDir()
        })
        .then(_ => {
            return filter.filter()
        })
        .then(_ => {
            return translate.translate()
        })
        .then(_ => {
            return jsRequire.jsRequire()
        })
        .then(_ => {
            if (gCase.optimize){
                return optimize.optimize()
            }
        })
        .then(_ => {
                return version.version()
        })
        .then(_ => {
            if (gCase.watch){
                filter.watch()
                translate.watch()
                jsRequire.watch()

                if (gCase.optimize){
                    optimize.watch()
                }
                version.watch()
            }
        })
        .catch(msg => {
            if (msg){
                console.error('Error', msg)
            }
            // process.exit(1)
        })
        .then(_ => {
            if (!gCase.watch){
                process.exit(0)
            }
        })
}

exports.main = main
