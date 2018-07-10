
let inquirer = require('inquirer')
let chalk = require('chalk')
let path = require('path')
let fs = require('fs-extra')
let util = require('../src/util')



let scaffold = {}

scaffold.create = function(rawName){
	inquirer.prompt([{
	    type: 'string',
	    message: 'Project name',
	    default: rawName,
	    name:'name'
	}]).then(answers => {
		if (fs.existsSync(path.resolve(answers.name))) {
		  	scaffold.existsCreate(answers.name)
		} else {
			scaffold.run(answers.name)
		}
	})
	
	
}

scaffold.existsCreate = function(rawName){
	inquirer.prompt([{
	    type: 'list',
	    message: `Target directory ${chalk.red(rawName)} already exists. Pick an action:`,
	    name: 'action',
	    choices: [
          { name: 'Overwrite', value: 'overwrite' },
          { name: 'Merge', value: 'merge' },
          { name: 'New name', value: 'Newname' },
          { name: 'Cancel', value: false }
        ]
	  }]).then(answers => {
	  	if(answers.action){
		  	if(answers.action == 'Newname'){
		  		inquirer.prompt([{
				    type: 'string',
				    message: 'Project name:',
				    name: 'name'
				}]).then(answers =>{
					if (fs.existsSync(path.resolve(answers.name))){
						scaffold.existsCreate(answers.name)
					}else{
						scaffold.run(answers.name)
					}
				})
		  	}else {
		  		if(answers.action == 'overwrite'){
			  		util.delDir(path.resolve(rawName))
			  	}
			  	scaffold.run(rawName)
		  	}
	  	}
	  	
	  }).catch(err =>{
	  	 util.error(err)
	  })
}

scaffold.run = function(name){
	let template = path.join(__dirname,'template')
	if(fs.existsSync(template)){
		util.walk(template, f => {
			if(path.basename(f) == 'yypack.json'){
				let packData = JSON.parse(util.getBody(f))
				packData.release.project = name
				inquirer.prompt([{
				    type: 'string',
				    message: 'port:',
				    name: 'port',
				    default:  packData.server.port
			    }]).then(answers => {
			    	packData.server.port = answers.port || packData.server.port
				    	inquirer.prompt([{
					    type: 'string',
					    message: 'domain:',
					    name: 'domain',
					    default: packData.release.domain
				    }]).then(answers => {
				    	packData.release.domain = answers.domain || packData.release.domain
				    	util.createF(path.join(path.resolve(name),path.relative(template, f)),JSON.stringify(packData, null, 4))
				    })
			    })
			}else if(path.basename(f) == 'gitignore.txt'){
				util.createF(path.join(path.resolve(name),'.gitignore'),util.getBody(f))
			}
			else{
				util.copy(f,path.join(path.resolve(name),path.relative(template, f)))
			}
		})
	}else{
		util.log('please update yypack')
	}
}



module.exports = scaffold