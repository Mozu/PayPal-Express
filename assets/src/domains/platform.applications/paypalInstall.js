/*
 * This custom function was generated by the Actions Generator
 * in order to enable the other custom functions in this app
 * upon installation into a tenant.
 */

var ActionInstaller = require('mozu-action-helpers/installers/actions');
//var tenantClient = require("mozu-node-sdk/clients/platform/tenant")();
var constants = require("mozu-node-sdk/constants");
var paymentConstants = require("../../paypal/constants");
var helper = require("../../paypal/helper");
var _ = require("underscore");


function AppInstall(context, callback) {
  var self = this;
  self.ctx = context;
  self.cb = callback;

  self.initialize = function() {
    console.log(context);
    console.log("Getting tenant", self.ctx.apiContext.tenantId);
    var tenant = context.get.tenant();
    enablePaypalExpressWorkflow(tenant);
  };

  function enablePaypalExpressWorkflow(tenant) {

    try {
      console.log("Installing PayPal Express payment settings", tenant);


      var tasks = tenant.sites.map(
              function(site) {
                return addUpdatePaymentSettings(context, site);
              }
            );

      Promise.all(tasks).then(function(result) {
        console.log("PayPal Express payment definition installed");
        addCustomRoutes(context, tenant);
      }, function(error) {
        self.cb(error);
      });


    } catch(e) {
      console.error("Paypal install error",e);
      self.cb(e);
    }
  }


  function addCustomRoutes(context, tenant) {
    var tasks = tenant.sites.map(
      function(site) {
        var customRoutesApi = require("mozu-node-sdk/clients/commerce/settings/general/customRouteSettings")();
        customRoutesApi.context[constants.headers.SITE] = site.id;
        return customRoutesApi.getCustomRouteSettings().then(
          function(customRoutes) {
            return appUpdateCustomRoutes(customRoutesApi, customRoutes);
          },
          function(err) {
            console.log("custom routes get error", err);
            return appUpdateCustomRoutes(customRoutesApi, {routes: []});
          }
        );
      }
    );

    Promise.all(tasks).then(function(result) {
      console.log("PayPal Express custom route installed");
      enableActions(context, tenant);
    }, function(error) {
      self.cb(error);
    });

  }

  function appUpdateCustomRoutes(customRoutesApi, customRoutes) {
     console.log(customRoutes);
      console.log("route array size", _.size(customRoutes.routes));
      //Add / Update custom routes for paypal
      customRoutes = getRoutes(customRoutes, "paypal/token","paypaltoken");
      customRoutes = getRoutes(customRoutes, "paypal/checkout","paypalProcessor");
      return customRoutesApi.updateCustomRouteSettings(customRoutes);

  }


  function addUpdatePaymentSettings(context, site) {
    console.log("Adding payment settings for site", site.id);
    var paymentSettingsClient = require("mozu-node-sdk/clients/commerce/settings/checkout/paymentSettings")();
    paymentSettingsClient.context[constants.headers.SITE] = site.id;
    //GetExisting
    var paymentDef = getPaymentDef();
    return paymentSettingsClient.getThirdPartyPaymentWorkflowWithValues({fullyQualifiedName :  paymentDef.namespace+"~"+paymentDef.name })
    .then(function(paymentSettings){
      return updateThirdPartyPaymentWorkflow(paymentSettingsClient, paymentSettings);
    },function(err) {
      return paymentSettingsClient.addThirdPartyPaymentWorkflow(paymentDef);
    });
  }

  function updateThirdPartyPaymentWorkflow(paymentSettingsClient, existingSettings) {
    var paymentDef = getPaymentDef(existingSettings);
    console.log(paymentDef);
    paymentDef.isEnabled = existingSettings.isEnabled;
    return paymentSettingsClient.deleteThirdPartyPaymentWorkflow({ "fullyQualifiedName" : paymentDef.namespace+"~"+paymentDef.name})
    .then(function(result) {
      return paymentSettingsClient.addThirdPartyPaymentWorkflow(paymentDef);
    });
  }

  function enableActions() {
    console.log("installing code actions");
    var installer = new ActionInstaller({ context: self.ctx.apiContext });
    installer.enableActions(self.ctx, null, {

      "embedded.commerce.payments.action.performPaymentInteraction" : function(settings) {
        settings = settings || {};
        settings.timeoutMilliseconds = settings.timeoutMilliseconds || 25000;
        return settings;
      },
      "paypalPaymentActionBefore" : function(settings) {
        settings = settings || {};
        settings.timeoutMilliseconds = settings.timeoutMilliseconds || 25000;
        return settings;
      },
      "paypalProcessor" : function(settings) {
        settings = settings || {};
        settings.timeoutMilliseconds = settings.timeoutMilliseconds || 25000;
        settings.configuration = settings.configuration || {"addBillingInfo" : false, "missingLastNameValue" : "N/A", "allowWarmCheckout" : true};
        return settings;
      },
      "paypalToken" : function(settings) {
        settings = settings || {};
        settings.timeoutMilliseconds = settings.timeoutMilliseconds || 25000;
        return settings;
      }

    }).then(self.cb.bind(null,null), self.cb);
  }


  function getPaymentDef(existingSettings) {
    return {
        "name": paymentConstants.PAYMENTSETTINGID,
        "namespace": context.get.nameSpace(),
        "isEnabled": "false",
        "description" : "<div style='font-size:13px;font-style:italic'>Please review our <a style='color:blue;' target='mozupaypalhelp' href='http://mozu.github.io/IntegrationDocuments/PayPalExpress/Mozu-PayPalExpress-App.htm'>Help</a> documentation to configure Paypal Express</div>",
        "credentials":  [
            getPaymentActionFieldDef("Environment", paymentConstants.ENVIRONMENT, "RadioButton", false,getEnvironmentVocabularyValues(), existingSettings),
            getPaymentActionFieldDef("User Name", paymentConstants.USERNAME, "TextBox", true,null,existingSettings),
            getPaymentActionFieldDef("Password", paymentConstants.PASSWORD, "TextBox", true,null,existingSettings),
            getPaymentActionFieldDef("Signature", paymentConstants.SIGNATURE, "TextBox", true,null,existingSettings),
            getPaymentActionFieldDef("Merchant account ID", paymentConstants.MERCHANTACCOUNTID, "TextBox", false,null,existingSettings),
            getPaymentActionFieldDef("Order Processing", paymentConstants.ORDERPROCESSING, "RadioButton", false,getOrderProcessingVocabularyValues(),existingSettings)
          ]
      };
  }

  function getEnvironmentVocabularyValues() {
    return [
      getVocabularyContent("production", "en-US", "Production"),
      getVocabularyContent("sandbox", "en-US", "Sandbox")
    ];
  }

  function getOrderProcessingVocabularyValues() {
    return [
      getVocabularyContent(paymentConstants.CAPTUREONSUBMIT, "en-US", "Authorize and Capture on Order Placement"),
      getVocabularyContent(paymentConstants.CAPTUREONSHIPMENT, "en-US", "Authorize on Order Placement and Capture on Order Shipment")
    ];
  }

  function getVocabularyContent(key, localeCode, value) {
    return {
      "key" : key,
      "contents" : [{
        "localeCode" : localeCode,
        "value" : value
      }]
    };
  }

  function getPaymentActionFieldDef(displayName, key, type, isSensitive, vocabularyValues, existingSettings) {
    value = "";
    if (existingSettings)
      value = helper.getValue(existingSettings, key);

    return {
            "displayName": displayName,
            "apiName": key,
            "inputType": type,
            "isSensitive": isSensitive,
            "vocabularyValues" : vocabularyValues,
            "value" : value
    };
  }


  function getRoutes(customRoutes, template,action) {
     var route =  {
      "template": template,
      "internalRoute": "Arcjs",
      "functionId": action,
     };

     var index = _.findIndex(customRoutes.routes, function(route) {return route.functionId == action; } );
     console.log("Action index "+action, index );
      if (index <= -1)
        customRoutes.routes[_.size(customRoutes.routes)] = route;
      else
        customRoutes.routes[index] = route;

      return customRoutes;

  }
}

module.exports = function(context, callback) {
  try {
      var appInstall = new AppInstall(context, callback);
      appInstall.initialize();
    } catch(e) {
      callback(e);
    }
};
