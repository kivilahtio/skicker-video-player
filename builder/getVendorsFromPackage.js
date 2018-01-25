#!/usr/bin/node

var fs = require('fs');

fs.readFile('package.json', {encoding: 'utf-8'}, function(err,data) {
  if (err) throw new Error("err");

  var package = JSON.parse(data);
  var vendors = Object.keys(package.dependencies).filter(function(k,i){
    return 1; //Why filter?
  }).forEach(function(item) {
    console.log(item);
  });


});


