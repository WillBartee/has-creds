var express = require('express');
var AWS = require('aws-sdk');
var http = require("http");

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
  //
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

app.get('/fetch/otherAppEnvs/:otherAppIP', function(req, res) {
  res.type('application/json');
  res.send(req.headers);
});


app.get('/fetch/otherAppEnvs/:otherAppIP', function(req, res) {
   var otherAppIP = req.params.otherAppIP
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


var shouldbe = {
  "Code" : "Success",
  "LastUpdated" : "2016-10-14T22:29:03Z",
  "Type" : "AWS-HMAC",
  "AccessKeyId" : "ASIAIL3AFBJXKKM7LE4Q",
  "SecretAccessKey" : "Mk9qKFvHUoyYauemVEACc8Dn/Fj6j6hRkGiWFMDw",
  "Token" : "FQoDYXdzELD//////////wEaDCsnxLYOcsyNCCkfJyK3A9c5d715M4e6aM+ZjW5GVC/NxT/hbitSSh+teHL/BN7CXlwZwVCEWrHlWgma1U9xel1V728/2lS5fCimwwN/40wUSiQM90GukZxuPHyki9N2SW+ThQ2AHdAbtdXBUIEuSP4PgMMuXhYIMruRKZkNCOWtexCljwkq86CPpvts5Sr1r/DTdZw6toiyyOAyI8tzkDHgan3oQe8CzJ6amGbM2T9pnEoIA63zQK9dHITKEC32BJ4u5Pqs2XGDS0fUfCP2hxy3D45Ghn+EBxzR089FVrlSB9KSXlddHvY09WPVJGA6M73MsYWXkQ1hn4oXy/4VxUHLGNwcjNo3RbwyCQO9l9JyCyDb4KJmf6YFPOoSTncxav21k9XrByUp5LBTEroO7PQ0eqMhI8COqSCaxMfAGbTBIK+PSIjlJfW7TedFzRwPQ5SWUifUnnR05n0moGSgNle/++mSeROqOR91E27+/qetDXKqb/B3F6GabkchZTkExWUBkh2bHAErAiFFdXOfz+j4pdha9qMwAzcQcKbReF5N4gXETJS09yDds5vAMwXXxRfJqRUvKyNdUky7dexKmzyiUsqhZAMo2biFwAU=",
  "Expiration" : "2016-10-15T04:45:05Z"
}

var is = {
  "ResponseMetadata": {
      "RequestId": "5d44663c-9263-11e6-a66d-412fd94f50d3"
    },
    "Credentials": {
      "AccessKeyId": "ASIAIS5PISCBB4MXXWYA",
      "SecretAccessKey": "axf24ELG6ujf0vUIgtOmGnrbpv6fYeK4pzpC0Q9U",
      "SessionToken": "FQoDYXdzELD//////////wEaDBTpeTORcKgUd7wg1iLLAYgQfEfb/nv01vi9TjDHUwaVfAK8geLb6woj6oeMfgMi1IdVFim6Al+PrifahEw61kfbtg8Us8ikIm67Tlg2/ARuRgbm24RD9E4REPgwjN/xgtzoErkJvsCCpnSn29RyKFmFaGg7MYV1u7kKoK0N9yBQBtvnc/lE2r9S57HJ9ia1fg6tzg84t6zxjPtzMnNsT9mdsYMHacYedCN8MYnHrHopF3fuO6OFcL0ObAwBabtA/C7EdwFFCKyyLLX1OjIy/a84TnfNfpGApugGKNbLhcAF",
      "Expiration": "2016-10-15T00:10:14.000Z"
    },
    "AssumedRoleUser": {
      "AssumedRoleId": "AROAJMEM7AI2BF5E2LHCK:Session1",
      "Arn": "arn:aws:sts::937109661149:assumed-role/ContainerS3/Session1"
    }
}

app.listen(process.env.PORT || 8080);
