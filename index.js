var express = require('express');
var AWS = require('aws-sdk');
var http = require("http");
var https = require("https");
var request = require('request');
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_ID,
  region: process.env.AWS_REGION
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
  console.log(STS);
  STS.assumeRole(params, function(err, data) {
    if (err) {
      console.log(err); // an error occurred
      res.status(err.statusCode).send(err);
    } else {
      console.log("Found credentials", data.Credentials.AccessKeyId);
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
  // Go fetch IAM_ROLE env var.
  //    1. endpoint on application.
  //    2. call deis to get the variable.
  // call kube master ip /api/v1/pods
  var remoteIP = req.connection.remoteAddress;
  // reverse_service_name_lookup(remoteIP, function(data, err){
  //   if(err) {
  //     // Should passthrough or mimic failure.
  //     res.status(404).send({msg: "failed to get service name from k8s", err: err});
  //   } else {
  //     get_iam_role_from_deis(appName, function(data, err){
  //       if(err) {
  //         console.log(err);
  //         res.status(404).send({msg: "unable to find configvalue from deis", err: err});
  //       } else {
  //         //TODO check to see if this is a valid role.
  //         // is call sts, and possibly cache the result.
  //         res.send(data);
  //       }
  //     });
  //   }
  // });

  var master = process.env.MASTER_IP || '10.1.128.9';

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
  var ip = req.headers['x-forwarded-for'] ||
       req.connection.remoteAddress ||
       req.socket.remoteAddress ||
       req.connection.socket.remoteAddress;
  res.type('application/json');
  var requestObj = {
    headers: req.headers,
    connection: req.conection,
    ipv2: ip,
    params: req.params,
    query: req.query,
    ip: req.ip,
    ips: req.ips
  };
  res.send({request:requestObj});
});

app.get('/app/:otherApp', function(req, res) {
  var hostname = req.query.dns == true
      ? req.params.otherApp+"."+process.env.ROUTE_NAME
      : req.params.otherApp;
  var params = {
    method: "GET",
    hostname: hostname,
    path: "/"+req.query.path
  };
  call_other_app(params, function(data, err){
    if(err) {
      console.log(err);
      res.status(404).send(err);
    } else {
      res.type('application/json');
      res.send(JSON.parse(data));
    }
  });
});

function call_other_app(params, callback) {
  var req = http.request(params, function (res) {
    var chunks = [];
    res.on("data", function (chunk) { chunks.push(chunk); });
    res.on("end", function () { callback(Buffer.concat(chunks)); });
  });
  req.end();
}

app.get('/lookupServiceName/:one/:two/:three/:four/', function(req, res) {
  var ip = req.params.one+"."+req.params.two+"."+req.params.three+"."+req.params.four;
  reverse_service_name_lookup(ip, function(data, err){
    if(err) {
      console.log(err);
      res.status(404).send(err);
    } else {
      res.send(data);
    }
  });
});

function reverse_service_name_lookup(ip, callback){
  var token = new Buffer("admin:"+process.env.K8S_STR).toString("base64");
  var options = {
    method: "GET",
    hostname: process.env.MASTER_IP,
    port: null,
    path: "/api/v1/pods",
    headers: {
      authorization: "Basic " + token
    },
    rejectUnauthorized: false,
    requestCert: true,
    agent: false
  };

  var req = https.request(options, function (res) {
    var chunks = [];
    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      var body = Buffer.concat(chunks);
      console.log("Completed");
      var parsed = JSON.parse(body);
      var filtered = parsed.items.filter(function(item){
        return item.status.phase == "Running" && item.status.podIP == ip;
      });
      var names = [];
      for (var pod in filtered ) {
        var podData = filtered[pod];
        names.push(podData.metadata.namespace);
      }
      callback(names);
    });
  });
  req.end();
}

app.get('/getIamRole/:appName/', function(req, res) {
  var params = {
    method: "GET",
    hostname: "deis."+process.env.ROUTE_NAME,
    path: "/v2/apps/"+req.params.appName+"/config/",
    headers: {
      authorization: "token "+process.env.DEIS_TOKEN
    }
  };
  get_iam_role_from_deis(appName, function(data, err){
    if(err) {
      console.log(err);
      res.status(404).send(err);
    } else {
      res.send(data);
    }
  });
});

function get_iam_role_from_deis(params, callback) {
  var req = http.request(params, function (res) {
    var chunks = [];

    res.on("data", function (chunk) { chunks.push(chunk); });
    res.on("end", function () {
      var parsed = JSON.parse(Buffer.concat(chunks));
      if (parsed.values["IAM_ROLE"]) {
        callback(parsed.values["IAM_ROLE"]);
      } else {
        callback(null, {error: "Service does not have the required configuration value."});
      }
    });
  });
  req.end();
}

app.listen(process.env.PORT || 8080);
