/*
 * openi_notif_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dconway, dmccarthy
 * Licensed under the APACHE2 license.
 */


'use strict';

var dbc = require('dbc')
var openiLogger = require('openi-logger')
var async = require('async')
var couchbase = require('couchbase')
var openiUtils = require('openi-cloudlet-utils')

var HTTPStatus  = require('http-status');

var logger;
var db;

var subtypes = ['PUSH', 'NOTIFICATION', 'SMS', 'EMAIL','push', 'notification', 'sms', 'email','Push', 'Notification', 'Sms', 'Email']


var init = function (logger_params) {
   logger = openiLogger(logger_params)
   db = new couchbase.Connection({host: 'localhost:8091', bucket: 'openi'}, function(err){
      if (err) {
         console.log('Connection Error', err);
      } else {
         console.log('Connected!');
      }
   });
}

var getPathSize = function (path) {
   var parts = path.split('/')
   return parts.length || 0
}

var getCloudlet = function (path) {
   var parts = path.split('/')
   var cletPos = 4;
   return parts[cletPos];
}

var getSubId = function (path) {
   var parts = path.split('/')
   var cletPos = 5;
   return parts[cletPos];
}

var getCouchbaseError = function(err, documentName, rest_uuid){

   switch (err.code){
   case 13:
      return 'Entity with that id does not exist';
      break;
   case 12:
      if (0 === documentName.indexOf('t_')){
         return 'OPENi Type already exists (' + rest_uuid + ').';
      }
      return 'Incorrect revision number provided';
      break;
   default:
      return "Reason unknown"
      break;
   }
}

var postSub = function (msg, callback) {

	var json = msg.json

	dbc.hasMember(json, 'cloudlet')
   dbc.hasMember(json, 'host')
   dbc.hasMember(json, 'subscription')

   dbc.hasMember(msg.subscription, 'objectid')
   dbc.hasMember(msg.subscription, 'type')
   dbc.hasMember(msg.subscription, 'endpoint')

   json._date_created  = new Date().toJSON()
   json._date_modified = new Date().toJSON()


   var subId         = 's_' + openiUtils.hash(json)
   var cloudlet      = getCloudlet(msg.path)
   var objectRestURL = "http://" + msg.headers.host + '/api/v1/subscription/' + mcloudlet + '/' + subId;

   json._id = objectRestURL

   var dbName = cloudlet + '+' + subId

   db.add(dbName, json, function (err, result) {

      if (err) {
         logger.log('error', err )
         var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
         callback(null,
            { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
            httpCode)
      }
      else {
         callback(null, { 'id' : objectRestURL }, HTTPStatus.CREATED)
      }
   })
}


var getSub = function (msg, callback) {

   if( getPathSize(msg.path) > 5 )
   {
      var dbName = getCloudlet(msg.path) + '+' + getSubId(msg.path)
      console.log("------" + dbname)

      db.get(dbName, function (err, db_body) {
         console.log(db.body)

         if (err) {
            logger.log('error', err )
            var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
            callback(null,
               { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
               httpCode)
         }
         else {
            //callback(null, { 'id' : db.body }, HTTPStatus.CREATED)
         }
      })
   }
   else {
   db.view('dev_subscriptions', 'subscriptions').query(function(err, res)
   {
      var respObj = [];

      for (var i = 0; i < res.length; i++){
         respObj[i] = {'@cloudlet' : res[i].key, '@id' : res[i].value}
      }

      callback(null,  respObj, HTTPStatus.OK)
   });
 }
}


var putSub = function (msg, callback) {

	dbc.hasMember(msg, 'cloudlet')
  dbc.hasMember(msg, 'host')
  dbc.hasMember(msg, 'subscription')

  dbc.hasMember(msg.subscription, 'objectid')
  dbc.hasMember(msg.subscription, 'type')
  dbc.hasMember(msg.subscription, 'endpoint')
  dbc.hasMember(msg.subscription, 'revision' )

   console.log(msg.host)
   // console.log()  
   // console.log(msg.subscription)
   var subId = 's_' + openiUtils.hash(msg.subscription)
   // console.log(subId)
   // console.log("----")

   var objectRestURL = "http://" + msg.host + '/api/v1/subscription/' + msg.cloudlet + '/' + subId;

   var dbName = msg.cloudlet + '+' + subId

   db.add(dbName, msg.subscription, function (err, result) {

      if (err) {
         logger.log('error', err )
         var httpCode = (12 === err.code) ? HTTPStatus.CONFLICT : HTTPStatus.INTERNAL_SERVER_ERROR;
         callback(null,
            { 'error' : 'Error adding entity: ' + getCouchbaseError(err, dbName, dbName) },
            httpCode)
      }
      else {
         callback(null, { 'id' : objectRestURL }, HTTPStatus.CREATED)
      }
   })
}


var addSubscription = function (msg, myCallback) {

   //console.log("Add Sunbcription")

   dbc.hasMember(msg.json, 'subscriptions')

   dbc.assert(msg.json.subscriptions.length > 0)

   var sub = {};
   sub.cloudlet = getCloudlet(msg.path)
   sub.host = msg.headers.host

   var json = msg.json
   

   var arr = {}

   console.log(json.subscriptions.length)

   for (var i = 0 ; i < json.subscriptions.length ; i++) {
      
      sub.subscription = json.subscriptions[i]
      arr[i] = actionToFunction(sub)
      
   }


   async.series(arr, function (err, results, httpStatusCode) {
      myCallback(err, results, httpStatusCode)
   })

}


var evaluateMessage = function (msg, callback) {
   var resp_msg = ''

   var pathSize = getPathSize(msg.path)
   console.log(msg)

   switch(msg.headers.METHOD){
   case 'POST':
      	postSub(msg, callback)
      break;
   case 'GET':
      	getSub(msg, callback)
      break;
   case 'PUT':
      	putSub(msg, callback)
      break;
   case 'DELETE':
      	deleteSub(msg, callback)
      break;
   default:
      break;
   }
}

module.exports.init = init
module.exports.evaluateMessage = evaluateMessage





