var express = require('express');
var AWS = require('aws-sdk');
var serviceId = require('service-identity');
var app = express();

app.get('/', function(req, res) {
  res.type('application/json'); // set content-type
  res.send({key:'string'}); // send text response
});

app.get('/env', function(req, res) {
  res.type('application/json'); // set content-type
  res.send(JSON.stringify(process.env)); // send text response
});

app.get('/healthcheck', function(req, res) {
  res.type('application/json'); // set content-type
  res.send(serviceId.whoami()); // send text response
});

app.get('/s3get', function(req, res) {
  var S3 = new AWS.S3();
  var reqParams = req.query.q
  var s3params = {
    Bucket: "pl.degaas.com",
    Key: reqParams
  }
  res.type('application/json');
  S3.getObject(s3params).
  on('httpData', function(chunk) { res.write(chunk); }).
  on('httpDone', function() { res.end(); }).
  send();
});

app.listen(process.env.PORT || 8080);
