/**
 * This is a scaffold for unit tests for the custom function for
 * `embedded.commerce.payments.action.before`.
 * Modify the test conditions below. You may:
 *  - add special assertions for code actions from Simulator.assert
 *  - create a mock context with Simulator.context() and modify it
 *  - use and modify mock Mozu business objects from Simulator.fixtures
 */

'use strict';

var Simulator = require('mozu-action-simulator');
var assert = Simulator.assert;

var actionName = 'embedded.commerce.payments.action.before';

describe('paypalPaymentActionBefore implementing embedded.commerce.payments.action.before', function () {

  var action;

  before(function () {
    action = require('../src/domains/commerce.payments/paypalPaymentActionBefore');
  });

  it('runs successfully', function(done) {

    var callback = function(err) {
      assert.ok(!err, "Callback was called with an error: " + err);
      // more assertions
      done();
    };

    var context = Simulator.context(actionName, callback);

    // modify context as necessary


    Simulator.simulate(actionName, action, context, callback);
  });
});
