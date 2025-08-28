const soap = require('soap');
const cheerio = require('cheerio'); // light jquery
const moment = require('moment');
const fs = require('fs-extra'); // filesystem extensions
const log4js = require("log4js");
const logger = log4js.getLogger("DownloadService");
logger.level = "debug";

var securityToken, sessionToken;

// XML Parsing Definition
exports.htmlparserOptions = {
  xmlMode: true,
  lowerCaseTags: true,
};

// Logon
function logon(config, onSuccess){
  logger.debug('Logging in');
  const mainArgs = {
    endpoint: config.ACC_ENDPOINT,
  };
  soap.createClient(config.WSDL_XTK_SESSION, mainArgs, function(errSoap, client) {
    if(errSoap){
        logger.debug('soap logon.createClient ERROR:'/*, err*/);
        process.exit();
        return;
      }

    var logonArgs = {
      sessiontoken : "",
      strLogin :  config.ACC_USER,
      strPassword : config.ACC_PWD,
      elemParameters : ""
    }

    client.Logon(logonArgs, function(errSoap, result, rawResult) {
      if(errSoap){
        logger.debug('soap logon.Logon ERROR:'/*, err*/);
        logger.debug('rawResult:', rawResult);
        process.exit();
        return;
      }
      // logger.debug(result);
      exports.securityToken = result.pstrSecurityToken.$value;
      exports.sessionToken = result.pstrSessionToken.$value;
      logger.debug('Logon OK with user:', result.pSessionInfo.sessionInfo.userInfo.attributes.loginCS);
      logger.debug('securityToken:', exports.securityToken);
      logger.debug('sessionToken:', exports.sessionToken);
      onSuccess({securityToken: exports.securityToken, sessionToken: exports.sessionToken});
    });
  });
}

/**
 * @param where string placed in <where>{where}</where>
 */
function getSpecFile(config, where, onSuccessHandler){
  var args = {
    sessiontoken : '',
    entity : {$xml :
      '<queryDef fullLoad="true" operation="get" schema="xtk:specFile">'+
        '<select>'+
          '<node expr="@namespace" hidden="true" />'+
          '<node expr="@name" hidden="false" />'+
          '<node expr="@label" />'+
          '<node expr="[definition/@id]" />'+
          '<node expr="[definition/@schema]" />'+
          '<node expr="[definition/@automaticDefinition]" />'+
          '<node expr="[definition/@lineCountMax]" />'+
          '<node anyType="true" expr="[definition/where]" noComputeString="true" />'+
          '<node anyType="true" expr="[definition/exclusions]" noComputeString="true" />'+
          '<node anyType="true" expr="[definition/orderBy]" noComputeString="true" />'+
        '</select>'+
        '<where>'+
          where+
        '</where>'+
      '</queryDef>'
    },
  }

  const mainArgs = {
    endpoint: config.ACC_ENDPOINT,
  };
  soap.createClient(config.WSDL_XTK_QUERYDEF, mainArgs, function(errSoap, xtkQueryDefClient){
    if(errSoap){
      logger.debug('soap getSpecFile.createClient ERROR:'/*, err*/);
      process.exit();
      return;
    }
    logger.debug('SOAP xtkQueryDefClient OK');
    exports.xtkQueryDefClient = xtkQueryDefClient;
    xtkQueryDefClient.addHttpHeader('X-Security-Token', exports.securityToken);
    xtkQueryDefClient.addHttpHeader('cookie',  "__sessiontoken=" + exports.sessionToken);

    xtkQueryDefClient.ExecuteQuery(args, function(errSoap, result, rawResponse, soapHeader, rawRequest) {
      if(errSoap){
        logger.debug('soap getSpecFile.ExecuteQuery ERROR:'/*, err*/);
        process.exit();
        return;
      }
      logger.debug('SOAP ExecuteQuery OK');

      onSuccessHandler(result, rawResponse, soapHeader, rawRequest);
    });
  });
}

function generateDoc(config, specFileDefinition, onSuccessHandler){
  logger.debug('SOAP xtkSpecfileClient...');
  const mainArgs = {
    endpoint: config.ACC_ENDPOINT,
  };
  soap.createClient(config.WSDL_XTK_SPECFILE, mainArgs, function(errSoap, xtkSpecfileClient){
    if(errSoap){
      logger.debug('soap generateDoc.createClient ERROR:'/*, err*/);
      process.exit();
      return;
    }
    logger.debug('SOAP xtkSpecfileClient OK');
    exports.xtkSpecfileClient = xtkSpecfileClient;
    xtkSpecfileClient.addHttpHeader('X-Security-Token', exports.securityToken);
    xtkSpecfileClient.addHttpHeader('cookie',  "__sessiontoken=" + exports.sessionToken);

    var args = {
      sessiontoken: '',
      entity: {$xml: specFileDefinition},
    };
    logger.debug('SOAP GenerateDoc...');
    xtkSpecfileClient.GenerateDoc(args, function(errSoap, result, rawResponse, soapHeader, rawRequest){
      if(config.SAVE_ARCHIVES == '1'){
        // save request to archives
        const archiveRequest = 'archives/'+moment().format('YYYY/MM/DD/HHmmss-SSS')+'-generateDoc-request.xml';
        fs.outputFileSync(archiveRequest, rawRequest, function (errFs) {
          throw errFs;
        });
        // save response to archives
        const archiveResponse = 'archives/'+moment().format('YYYY/MM/DD/HHmmss-SSS')+'-generateDoc-response.xml';
        fs.outputFileSync(archiveResponse, rawResponse, function (errFs) {
          throw errFs;
        });
      }
      // sometimes, it breaks with a false-positive error
      if(errSoap && errSoap.Fault && errSoap.Fault.detail == 'Error: Non-whitespace before first tag.\nLine: 0\nColumn: 1\nChar: /'){
        logger.warn('False positive error', errSoap.Fault);
      }
      else if(errSoap){
        const archiveResponse = 'errors/'+moment().format('YYYY/MM/DD/HHmmss-SSS')+'-generateDoc-error.xml';
        fs.outputFileSync(archiveResponse, JSON.stringify(errSoap.Fault), function (errFs) {
          throw errFs;
        });
        logger.debug('soap generateDoc.GenerateDoc ERROR:'/*, err*/);
        process.exit();
        return;
      }
      logger.debug('SOAP GenerateDoc OK');

      onSuccessHandler(config, result, rawResponse, soapHeader, rawRequest);
    });
  });
}

module.exports = {
  generateDoc,
  getSpecFile,
  logon
}