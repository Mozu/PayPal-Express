/**
 * Implementation for http.storefront.routes


 * HTTP Actions all receive a similar context object that includes
 * `request` and `response` objects. These objects are similar to
 * http.IncomingMessage objects in NodeJS.

{
  configuration: {},
  request: http.ClientRequest,
  response: http.ClientResponse
}

 * Call `response.end()` to end the response early.
 * Call `response.set(headerName)` to set an HTTP header for the response.
 * `request.headers` is an object containing the HTTP headers for the request.
 *
 * The `request` and `response` objects are both Streams and you can read
 * data out of them the way that you would in Node.

 */

var paypal = require('../../paypal/checkout');
var helper = require('../../paypal/helper');

module.exports = function(context, callback) {
  try {
    paypal.getToken(context, callback)
    .then(function(data){
      context.response.body = data;
      context.response.end();
    }, function(err) {
      console.error(err);
      context.response.statusCode = 500;
      context.response.body = err;
      context.response.end();
    });  	//paypal.checkUserSession(context);
  } catch(err) {
    console.error(err);
    context.response.statusCode = 500;
    context.response.body = err;
    context.response.end();
  }

};
