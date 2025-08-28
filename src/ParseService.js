const FCO_ACC = require('./DownloadService.js'); // FCO lib
const cheerio = require('cheerio'); // light jquery
const fs = require('fs-extra'); // filesystem extensions
const tmp = require('tmp');
// const _ = require('lodash'); // js extensions
const sanitize_filename = require("sanitize-filename"); // get clean filename
const pd = require('pretty-data').pd;
const log4js = require("log4js");
const logger = log4js.getLogger("ParseService");
logger.level = "debug";

const folders = [];

function parseFinalPackage(config, result, rawResponse, soapHeader, rawRequest){
  logger.debug('parseFinalPackage...');
  const instanceDir = config.INSTANCE_DIR;

  // const tmpobj = tmp.fileSync({prefix: 'FCO_ACC', postfix: 'generateDoc.xml'});
  //   logger.debug('generateDoc ready: ', tmpobj.name);
  //   tmpobj.removeCallback();
  //   fs.outputFileSync(tmpobj.name, rawResponse, function (err) {
  //     throw err;
  //   });
  //   logger.debug('generateDoc ready: ', tmpobj.name);

  const $ = cheerio.load(rawResponse, FCO_ACC.htmlparserOptions);

  // package structure:
  // <package>
  //   <entities schema="xtk:form">
  //     <form></form>
  //     <form></form>
  //   </entities>
  // </package>

  // for each entity (form, workflow...)
  $('entities').each(function(i, elem){
    const $this = $(this);
    // get the entity name, i.e. "xtk:form"
    var namespacedSchema = $this.attr('schema');
    var namespace = namespacedSchema.split(':')[0];
    var schema = namespacedSchema.split(':')[1];
    logger.debug('- Namespaced Schema: '+namespacedSchema+', listing "'+schema+'" with '+$this.children().length+' children:');
    // for each entity
    $this.children().each(function(i, elem){
      if(elem.tagName.toLowerCase() != schema.toLowerCase()){
        logger.debug('(child skipped because tagName '+elem.tagName+') doesn\'t match');
        return;
      }
      const $this = $(this);
      var dir, filename;
      // if it has a folder
      if($this.children('folder').length){
        /*
        var folderName = $this.children('folder').first().attr('name');
        if(folderName !== undefined && folders[folderName] === undefined){
          logger.debug('has new folder:', folderName);
          // get folder full path
          var folderFullPath = getFolderFullNameByName(FCO_ACC.xtkQueryDefClient, folderName);
          folders[folderName]= {
            'name': folderName,
            'fullName': folderFullPath
          };
          logger.debug('folderFullPath', folderFullPath);
        }
        */
      } else {
        /*
        logger.debug('NO folder');
        // get folder
        logger.debug('before');
        var camelCaseNamespacedSchema = namespace + schema[0].toUpperCase() + schema.substr(1);
        logger.debug('camelCaseNamespacedSchema:', camelCaseNamespacedSchema);
        getFolderFullNameByName(xtkQueryDefClient, camelCaseNamespacedSchema);
        logger.debug('after');
        */
      }

      // html to be written to file
      var html = $.html($this);

      // can be factorized but keep it this way ATM
      // @todo get folder path from instance for schemas with @folder-id field
      switch(namespacedSchema){
        // XTK
        case 'xtk:srcSchema':
          dir = instanceDir+'/Administration/Configuration/Data schemas/'+$this.attr('namespace')+'/';
          filename = $this.attr('name')+'.html';
          break;
        case 'xtk:form':
          dir = instanceDir+'/Administration/Configuration/Input forms/'+$this.attr('namespace')+'/';
          filename = $this.attr('name')+'.html';
          break;
        case 'xtk:navtree':
          dir = instanceDir+'/Administration/Configuration/Navigation hierarchies/'+$this.attr('namespace')+'/';
          filename = $this.attr('name')+'.html';
          break;
        case 'xtk:javascript':
          dir = instanceDir+'/Administration/Configuration/JavaScript codes/'+$this.attr('namespace')+'/';
          filename = $this.attr('name')+'.js';
          break;
        case 'xtk:jssp':
          dir = instanceDir+'/Administration/Configuration/Dynamic JavaScript pages/'+$this.attr('namespace')+'/';
          filename = $this.attr('name')+'.js';
          break;
        case 'xtk:folder':
          dir = instanceDir+'/Explorer/';
          filename = $this.attr('name')+'.xml';
          /// edit XML
          html = pd.xml(html); // pretty print
          /// end edit XML
          break;
        case 'xtk:formRendering':
          dir = instanceDir+'/Administration/Configuration/Form rendering/';
          filename = $this.attr('internalName')+'.css';
          break;
        case 'xtk:sql':
          dir = instanceDir+'/Administration/Configuration/SQL scripts/'+$this.attr('namespace')+'/';
          filename = $this.attr('name')+'.sql';
          break;
        case 'xtk:xslt':
          dir = instanceDir+'/Administration/Configuration/XSL style sheets/'+$this.attr('namespace')+'/';
          filename = $this.attr('name')+'.html';
          break;
        case 'xtk:workflow':
          dir = instanceDir+'/Administration/Production/';
          filename = $this.attr('internalName')+'.html';
          /// edit XML
          html = html.replace(/eventCount="\d+"/g, ''); // remove eventCount="111"
          html = html.replace(/taskCount="\d+"/g, ''); //and taskCount="222"
          // pretty print
          html = pd.xml(html);
          /// end edit XML
          break;
        // NMS
        case 'nms:typology':
          dir = instanceDir+'/Administration/Campaign Management/Typology management/Typologies/';
          filename = $this.attr('name')+'.html';
          break;
        case 'nms:typologyRule':
          dir = instanceDir+'/Administration/Campaign Management/Typology management/Typology rules/';
          filename = $this.attr('name')+'.html';
          break;
        case 'nms:trackingUrl':
          dir = instanceDir+'/Resources/Online/Web tracking tags/';
          filename = $this.attr('tagId')+'.html';
          break;
        case 'nms:webApp':
          dir = instanceDir+'/Resources/Online/Web applications/';
          filename = $this.attr('internalName')+'.html';
          break;
        case 'nms:deliveryMapping':
          dir = instanceDir+'/Administration/Campaign Management/Target mappings/';
          filename = $this.attr('name')+'.html';
          break;
        case 'nms:includeView':
          dir = instanceDir+'/Resources/Campaign Management/Personalization blocks/';
          filename = $this.attr('name')+'.html';
          break;
        case 'nms:operation':
          dir = instanceDir+'/Campaign Management/Campaigns/';
          filename = $this.attr('internalName')+'.html';
          /// edit XML
          // remove nodes
          //logger.debug($this.find('variables'));
          $this.find('variables').each(function(){
            const $this = $(this);
            // remove inside
            $this.empty();
            // TODO remove attr (not working ATM)
            while(this.attribs && this.attribs.length > 0){
              this.removeAttribute(this.attribs[0].name);
            }
          });
          html = $.html($this);
          html = html.replace(/ eventCount="\d+"/g, ''); // remove eventCount="111"
          html = html.replace(/ taskCount="\d+"/g, ''); //and taskCount="222"
          html = html.replace(/ duration="\d+"/g, ''); //and duration="222"
          // pretty print
          html = pd.xml(html);
          /// end edit XML
          break;
        // Default
        default:
          logger.debug('Not yet implemented but adding it to .tmp');
          dir = instanceDir+'/.tmp/';
          filename = namespace+'_'+schema+'_'+$this.attr('name')+'_'+$this.attr('internalName')+'.xml';
          break;
      }
      var path = dir+sanitize_filename(filename);
      logger.debug('(name '+$this.attr('name')+') (internalName '+$this.attr('internalName')+') saved as "'+filename+'"');
      // save
      fs.outputFileSync(path, html, function (err) {
        throw err;
      });
    });
  });


  // for each workflow
  /*
  $('workflow').each(function(i, elem){
    const $this = $(this);
    logger.debug('- Workflow id:', $this.attr('id'));
    var acFolder = $this.children('folderFullName').text();
    if(!_(acFolder).startsWith('/') || !_(acFolder).endsWith('/')){
      logger.debug('- Unable to get AC folder for workflow '+$this.attr('label')+' ('+$this.attr('id')+')');
      logger.debug(acFolder.substring(0, 30));
      // logger.debug(this);
      // process.exit();
      return;
    }
    var filename = sanitize_filename($this.attr('label')+' ('+$this.attr('internalName')+') ('+$this.attr('id')+')');
    var path = instanceDir+acFolder+filename+config.WORKFLOW_EXTENSION;
    logger.debug('saved to path', path);
    // read again
    var content = cheerio.load(this, htmlparserOptions).xml();
    // pretty print
    content = pd.xml(content);
    // save
    fs.outputFileSync(path, content, function (err) {
      throw err;
    });
  });
  */
  logger.debug('parseFinalPackage... OK');
}

function addNewLineForXmlStartTag(xmlString){
  // \w for any letter, \d for any digit, -=" for attributes, : for ACC namespace
  // @ for ACC fields, [!] for CDATA, &; for lt gt, / for ending tag or no child tag
  // () for ACC label
  const xmlStartTagRegex = /(<[\w =":&;@\[\]!\d/\-\(\)]+?>)/ig;
  return xmlString.replace(xmlStartTagRegex, '$1\n');
}

// can be factorized as
// getXbyField(xtkQueryDefClient, fieldName, fieldValue, select['@fullName', '@id'])
function getFolderFullNameByName(xtkQueryDefClient, folderName){
  var args = {
    sessiontoken : '',
    entity : {$xml :
      '<queryDef operation="get" schema="xtk:folder">'+
        '<select><node expr="@fullName"/></select>'+
        '<where><condition expr="@name = \''+folderName+'\'"/></where>'+
      '</queryDef>'
    },
  }
  var fullName;
  logger.debug('getFolderFullNameByName:', folderName, '1');
  xtkQueryDefClient.ExecuteQuery(args, function(err, result, rawResponse, soapHeader, rawRequest) {
    logger.debug('getFolderFullNameByName:', folderName, '3');
    const $ = cheerio.load(rawResponse, FCO_ACC.htmlparserOptions);
    logger.debug('getFolderFullNameByName:', folderName, $('folder').attr('fullName'), '4');
    // var regex = /<folder fullName="(.+)"\/><\/pdomOutput>/;
    // return regex.match(rawResponse)[1];
  });
  logger.debug('getFolderFullNameByName:', folderName, '2');
}

// logon > getSpecFile > generateDoc > parseFinalPackage
function downloadAndParse(config){
  logger.debug('instanceDir: '+config.INSTANCE_DIR);
  FCO_ACC.logon(config, function(data){
    FCO_ACC.getSpecFile(config, config.PACKAGES, function(result, rawResponse, soapHeader, rawRequest){
      const tmpobj = tmp.fileSync({prefix: 'FCO_ACC', postfix: 'getSpecFile.xml'});
      logger.debug('getSpecFile ready: ', tmpobj.name);
      tmpobj.removeCallback();
      fs.outputFileSync(tmpobj.name, rawResponse, function (err) {
        throw err;
      });
      logger.debug('getSpecFile ready: ', tmpobj.name);
      const $ = cheerio.load(rawResponse, FCO_ACC.htmlparserOptions);
      var specFileDefinition = $('pdomOutput').html();
      logger.debug('XML Definition OK');
      FCO_ACC.generateDoc(config, specFileDefinition, parseFinalPackage);
    });
  });
}

module.exports = {
  downloadAndParse
}