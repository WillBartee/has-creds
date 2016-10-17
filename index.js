var express = require('express');
var AWS = require('aws-sdk');
var http = require("http");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});


// var serviceId = require('service-identity');
var app = express();

app.get('/env', function(req, res) {
  res.type('application/json'); // set content-type
  if( req.query.sort )
    res.send(sortObject(process.env)); // send text response
  else
    res.send(process.env);
});

function sortObject(obj) {
    var arr = [];
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            arr.push({
                'key': prop,
                'value': obj[prop]
            });
        }
    }
    arr.sort(function(a, b) { return a.value - b.value; });
    //arr.sort(function(a, b) { a.value.toLowerCase().localeCompare(b.value.toLowerCase()); }); //use this to sort as strings
    return arr; // returns array
}
// app.get('/healthcheck', function(req, res) {
//   res.type('application/json'); // set content-type
//   res.send(serviceId.whoami()); // send text response
// });

/* TODO Upon start up Barry wants this to fetch all the things aside from creds that
 *      is available from the magic ip.
 */

app.get('/s3get', function(req, res) {
  var S3 = new AWS.S3();
  res.type('application/json');
  S3.getObject({
    Bucket: req.query.b,
    Key: req.query.f
  }).
  on('httpData', function(chunk) { res.write(chunk); }).
  on('httpDone', function() { res.end(); }).
  send();
});

app.get('/latest/meta-data/iam/security-credentials/:roleName', function(req, res) {
  var STS = new AWS.STS();
  res.type('application/json');
  var params = {
    RoleArn: "arn:aws:iam::"+process.env.AWS_ACCT+":role/"+req.params.roleName, /* required */
    RoleSessionName: "Session1" /* required */
  };
  STS.assumeRole(params, function(err, data) {
    if (err) {
      console.log(err); // an error occurred
      res.status(err.statusCode).send(err);
    } else {
      console.log(data);
      var response = transformSTS2Creds(data);
      res.send(response);
    }
  });
});


// TODO RUN script/that/traverses/magicip/for/static/values/and/records/them/to/files.sh

// When this is called we should only return the values that this app "has access to"
// This is performed by determining what roles it thinks it should have.
// call deis to get the CONFIG value of IAM_ROLE
app.get('/latest/meta-data/iam/security-credentials/', function(req, res) {
  var remoteIP = req.connection.remoteAddress;
  // Go fetch IAM_ROLE env var.
  //    1. endpoint on application.
  //    2. call deis to get the variable.
  // call kube master ip /api/v1/pods
  var master = process.env.MASTER_IP || '10.171.128.9';

  res.type('text/plain');
  var responseData = "";
  var roleNames = JSON.parse(process.env.ROLE_NAMES).roles;
  for( var role in roleNames ) {
    responseData = responseData+"\n"+ roleNames[role];
  }
  res.send(responseData);
});

function transformSTS2Creds(stsData)
 {
   return {
     Code: "Success",
     LastUpdated: "2016-10-14T22:29:03Z",
     Type: "AWS-HMAC",
     AccessKeyId: stsData.Credentials.AccessKeyId,
     SecretAccessKey: stsData.Credentials.SecretAccessKey,
     Token: stsData.Credentials.SessionToken,
     Expiration: stsData.Credentials.Expiration,
     STSResponse: stsData
   };
}

app.get('/headers', function(req, res) {
  res.type('application/json');
  var requestObj = {
    headers: req.headers,
    connection: req.conection,
    params: req.params,
    query: req.query,
    ip: req.ip
  };
  res.send({request:requestObj, awscreds: AWS.config});
});

app.get('/callOtherApp/:otherApp', function(req, res) {
  var url = 'http://'+req.params.otherApp+'/'+req.query.path;
  http.get(url, function(resp){
    var body = '';
    resp.on('data', function(chunk){
      body += chunk;
    });
    resp.on('end', function(){
      var fbResponse = JSON.parse(body);
      console.log("Got a response: ");
      res.send(body);
    });
  }).on('error', function(e){
      console.log("Got an error: ", e);
  });
});

/*
Needs to happen:
  I am a service I need credential I call "magic ip".

How it happens:
  I am the cluster local "magic ip spoofer".
    I need to return on calls to me a valid set of credentials for a specific role.
    For that response I must know:
      What role it should have.
        How do we get that:
          from the api path     var basePath = '/latest/meta-data/iam/security-credentials/';
*/

app.listen(process.env.PORT || 8080);
