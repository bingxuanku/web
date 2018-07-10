#!/usr/bin/python
#coding:utf-8
import os,sys,platform,subprocess,time,json,shutil,re,stat

#yypack 集成
with open('yypack.json') as f:
    yypackConfig = json.loads(f.read())

#判断当前系统
isWindows = 'Windows' == platform.system()

if isWindows:
    import paramiko

#前端项目名
project = yypackConfig['release']['project']

#前端上线发布分支所在目录
feRelease = '../fe-release-group/'

#初始化目录
def initDir():
    if not os.path.exists(feRelease):
        os.makedirs(feRelease);

#获取当前git分支
def getGitBranch():
    branches = subprocess.check_output(['git', 'branch']).split('\n')
    for b in branches[0:-1]:
        if b[0] == '*':
            return b.lstrip('* ')

    return None


def exeCmd(cmd):
    print '------------------------------------------------------'
    print cmd
    os.system(cmd)

def releaseDev():
    print 'release to dev'
    exeCmd('yypack release dev')

def releaseQa():

    bakTmp = yypackConfig['release']['cases']['qa']['www']

    #删除遗留的__dist
    if os.path.exists(bakTmp):
        shutil.rmtree(bakTmp)

    #进行打包编译
    cmd = 'yypack release qa'
    exeCmd(cmd)
    #删除服务器项目目录

    #复制版本文件
    filepath = bakTmp + project + '/page/router'
    if(os.path.exists(filepath)):
        versionFile = bakTmp + project + '/page/router/router.js'
        for root, dirs, files in os.walk(filepath):
            inputFile = open(root+"/"+files[0], "r")
            outputFile = open(versionFile, "a");
            allLines =  inputFile.readlines();
            for eachLine in allLines:
                outputFile.write(eachLine);
            inputFile.close();
            outputFile.close();

    #拷贝静态资源到测试服务器
    print 'release to  172.28.3.21 start'

    if isWindows:
        # cmd = 'scp -r ' + bakTmp + project + ' user_h5@172.28.3.21:/share/yyfq/'
        # exeCmd(cmd)
        scp=paramiko.Transport(('172.28.3.21',22))
        scp.connect(username="user_h5",password="yyfq.com")
        sftp=paramiko.SFTPClient.from_transport(scp)
        winUpload(sftp,bakTmp)
        scp.close()
    else:
        cmd = 'rsync -azvP --delete ' + bakTmp + project + ' user_h5@172.28.3.21:/share/yyfq/'
        exeCmd(cmd)

    print 'release to  172.28.3.21 end'
    if os.path.exists(bakTmp):
        shutil.rmtree(bakTmp)

def winUpload(sftp,dir):
    bakTmp = yypackConfig['release']['cases']['qa']['www']
    files=os.listdir(dir)
    for f in files:
        rmpath = os.path.join(dir,f)
        if os.path.isdir(rmpath):
            d = re.sub(r'\\','/',rmpath.replace(bakTmp,'/share/yyfq/'))
            try:
                sftp.stat(d)
            except IOError:
                sftp.mkdir(d)
            winUpload(sftp,os.path.join(dir,f))
        else:
            rmf = re.sub(r'\\','/',os.path.join(dir,f).replace(bakTmp,'/share/yyfq/'))
            print rmf
            sftp.put(os.path.join(dir,f),rmf)

def releaseOnline():
    #前端上线发布分支地址
    feReleaseGit = yypackConfig['deploy']['feReleaseGit']

    print 'release to fe-release start...'
    bakTmp = yypackConfig['release']['cases']['www']['www']

    #检测是否在master分支
    if getGitBranch() != 'master':
        print 'please merge to master!'
        return

    #删除遗留的__dist
    if os.path.exists(bakTmp):
        shutil.rmtree(bakTmp)

    #进行打包编译
    cmd = 'yypack release www'
    exeCmd(cmd)

    #复制版本文件
    filepath = bakTmp + project + '/page/router'
    if(os.path.exists(filepath)):
        versionFile = bakTmp + project + '/page/router/router.js'
        for root, dirs, files in os.walk(filepath):
            inputFile = open(root+"/"+files[0], "r")
            outputFile = open(versionFile, "a");
            allLines =  inputFile.readlines();
            for eachLine in allLines:
                outputFile.write(eachLine);
            inputFile.close();
            outputFile.close();


    #删除原有release目录并且clone最新的
    currPath = os.getcwd()
    os.chdir(os.path.join(currPath, feRelease))

    if isWindows:
        #删除原有release目录
        if(os.path.exists(project)):
            setChmod(project)
            shutil.rmtree(project)
        exeCmd('git clone ' + feReleaseGit)
        for path in os.listdir(os.path.join(feRelease, project)):
            fullpath = os.path.join(feRelease, project,path)
            if os.path.isdir(fullpath):
                if path[0] != '.':
                    shutil.rmtree(fullpath)
            else:
                os.remove(fullpath)

        #将打包编译的文件拷贝到fe-release
        os.chdir(currPath)
        src = os.path.join(bakTmp, project)
        for name in os.listdir(src):
            srcname = os.path.join(src, name)
            if os.path.isdir(srcname):
                shutil.copytree(srcname,os.path.join(feRelease, project,name))
            else:
                shutil.copy2(srcname,os.path.join(feRelease, project))
    else:
        #删除原有release目录
        exeCmd('rm -rf ' + project)
        exeCmd('git clone ' + feReleaseGit)

        #将打包编译的文件拷贝到fe-release
        os.chdir(currPath)
        exeCmd('rm -rf ' + os.path.join(feRelease, project, "*"))

        cmd = 'scp -r ' + os.path.join(bakTmp, project, '*') + ' ' + os.path.join(feRelease, project)
        exeCmd(cmd)

        cmd = 'scp -r ' + os.path.join(bakTmp, project, 'page') + ' ' + os.path.join(feRelease, project)
        exeCmd(cmd)

    #切到fe-release git push
    os.chdir(os.path.join(currPath, feRelease, project))
    exeCmd('git add .')
    exeCmd('git commit -m "auto commit" *')
    exeCmd('git push')

    # #打tag
    exeCmd('git tag www/' + project + '/' + time.strftime('%Y%m%d.%H%M'))
    exeCmd('git push --tags')

    #切回到当前目录
    os.chdir(currPath)
    if os.path.exists(bakTmp):
        shutil.rmtree(bakTmp)

    print 'release to fe-release end'

def setChmod(dir):
    for path in os.listdir(dir):
        fullpath = os.path.join(dir, path)
        if stat.S_ISDIR(os.lstat(fullpath).st_mode):
            setChmod(fullpath)
        else:
            os.chmod(fullpath, stat.S_IRWXU|stat.S_IRGRP|stat.S_IROTH)


def main():
    initDir()

    argv = sys.argv
    if len(argv) == 1:
        exeCmd('yypack server start')
        return

    cmdType = sys.argv[1]

    if cmdType == 'dev':
        releaseDev()

    elif cmdType == 'qa':
        releaseQa()

    elif cmdType == 'www':
        releaseOnline()
    elif cmdType == 'stg':
            releaseStg()
    else:
        print 'please choose one : dev,qa,www'

if __name__ == "__main__":
    main()
