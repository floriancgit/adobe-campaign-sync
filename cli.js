#!/usr/bin/env node

const { program } = require('commander');
const yaml = require('js-yaml');
const fs = require('fs-extra'); // filesystem extensions

// modules
const { downloadAndParse } = require('./src/ParseService.js')

program
  .name('adobe-campaign-sync')
  .description('Adobe Campaign Synchronization')
  .version('1.0.0');

var config;
program
  .command('download')
  .description('Download the entities in the package from the .env file')
  .requiredOption('-c, --config <config>', 'Configuration file')
  .action((options) => {
    // load config
    const fileContent = fs.readFileSync(options.config, 'utf8');
    config = yaml.load(fileContent);
    // check config
    if(!config.ACC_USER || !config.ACC_PWD || !config.ACC_ENDPOINT){
        logger.debug('Define .env.ACC_USER .env.ACC_PWD .env.ACC_ENDPOINT');
        process.exit();
    }
    if(!config.PACKAGES){
        logger.debug('Define .env.PACKAGES');
        process.exit();
    }



    console.log(options);
    console.log(config);
    downloadAndParse(config);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}