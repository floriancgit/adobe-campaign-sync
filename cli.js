#!/usr/bin/env node

const { program } = require('commander');
const yaml = require('js-yaml');
const fs = require('fs-extra'); // filesystem extensions

// modules
const { downloadAndParse, parseFinalPackage } = require('./src/ParseService.js')

// program
program
  .name('adobe-campaign-sync')
  .description('Adobe Campaign Synchronization')
  .version('1.1.0');

var config;

// CHECK CONFIG
function loadConfig(configFilePath){
  const fileContent = fs.readFileSync(configFilePath, 'utf8');
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
  console.log(config);
}
// DOWNLOAD
program
  .command('download')
  .description('Download the entities in the package from the .env file')
  .requiredOption('-c, --config <config>', 'Configuration file')
  .action((options) => {
    console.log(options);
    loadConfig(options.config);
    downloadAndParse(config);
  })
;
// PARSE
program
  .command('parse')
  .description('Parse the entities from an XML package file')
  .requiredOption('-c, --config <config>', 'Configuration file')
  .requiredOption('-f, --file <file>', 'XML Package file')
  .action((options) => {
    console.log(options);
    loadConfig(options.config);
    const fileContent = fs.readFileSync(options.file, 'utf8');
    parseFinalPackage(config, null, fileContent, null, null);
  })
;

// go
program.parse(process.argv);
if (!process.argv.slice(2).length) {
  program.help();
}