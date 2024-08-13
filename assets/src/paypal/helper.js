
var getAppInfo = require('mozu-action-helpers/get-app-info');
var url = require("url");
var qs = require("querystring");
var paymentConstants = require("./constants");
var _ = require("underscore");
var constants = require("mozu-node-sdk/constants");
var Order = require("mozu-node-sdk/clients/commerce/order");
var Checkout = require("mozu-node-sdk/clients/commerce/checkout");
var Cart = require("mozu-node-sdk/clients/commerce/cart")();

var helper = module.exports = {
	createClientFromContext: function (client, context, removeClaims) {
	  var c = client(context);
	  if (removeClaims)
		  c.context[constants.headers.USERCLAIMS] = null;
	  return c;
	},
	getUrlPrefix: function(context){
		//default prefix to siteSubdirectory 
		var prefix = context.items.siteContext.siteSubdirectory || '';
		var config = (context.configuration || {}).subdirectories;
		//allow override of prefix from config
		if(config && config[context.apiContext.siteId]){
			prefix = config[context.apiContext.siteId];
		}
		return prefix;
	},
	isTokenRequest: function(context) {
		 return context.request.url.indexOf("/paypal/token") > -1;
	},
	isCartPage: function(context) {
		return context.request.url.indexOf("/cart") > -1;
	},
	isCheckoutPage: function(context) {
		return context.request.url.indexOf("/checkout") > -1;
	},
	parseHref: function(context) {
		var urlParseResult = url.parse(context.request.href);
		console.log("parsedUrl", urlParseResult);
		return urlParseResult;
	},
	parseUrl: function(context) {
		var self = this;
		var urlParseResult = url.parse(context.request.url);
		var queryStringParams = qs.parse(urlParseResult.query);
		return queryStringParams;
	},
	isPayPalCheckout: function(context) {
		var queryString = this.parseUrl(context);
		return (queryString.PayerID !== "" &&
			queryString.token !== "" && queryString.id !== ""  );
	},
	getPaymentFQN: function(context) {
		var appInfo = getAppInfo(context);
		return appInfo.namespace+"~"+paymentConstants.PAYMENTSETTINGID;
	},
	getValue: function(paymentSetting,  key) {
		var value = _.findWhere(paymentSetting.credentials, {"apiName" : key}) || _.findWhere(paymentSetting.Credentials, {"APIName" : key}) ;

	    if (!value) {
	      console.log(key+" not found");
	      return;
	    }
	    //console.log("Key: "+key, value.value );
	    return value.value || value.Value;
	},
	getParamsToPreserve: function(params) {
		delete params.id;
		delete params.token;
		delete params.isCart;
		delete params.PayerID;
		delete params.paypalCheckout;
    delete params.ppErrorId;
    delete params.startpaypalcheckout;
		var queryString = "";
		Object.keys(params).forEach(function(key){
			if (queryString !== "")
			queryString += "&";
			queryString += key +"=" + params[key];
		});
        return queryString;
    },
    getStoreCredits: function(order) {
		var storeCredits = _.filter(order.payments,function(payment) {return ((payment.paymentType === "StoreCredit" || payment.paymentType === "GiftCard") && payment.status != "Voided"); });
		return _.map(storeCredits , function(credit) {
						return {
							name: credit.paymentType,
							quantity: 1,
							amount: -credit.amountRequested
						};
					}) ;
	},
    getActiveDiscountItems: function(discounts) {
		var activeDiscounts = _.filter(discounts, function(discount) { return discount.excluded === false;});
		if (activeDiscounts.length === 0)
			activeDiscounts = _.filter(discounts, function(discount) { return discount.discount.excluded === false; });

		return 	_.map( activeDiscounts , function(discount) {
			return {
				name: discount.discount.name || discount.discount.discount.name,
				quantity: 1,
				amount: -discount.impact || -discount.discount.impact
			};
		});
	},
    getItems: function (order, includeStoreCredits) {
    	var self = this;
		var items=	_.map(order.items, function(item) {
			return 	{
				name: item.product.name,
				quantity: item.quantity,
				description: item.product.description,
				amount: parseFloat(item.discountedTotal/item.quantity).toFixed(2),
				lineId: item.lineId//,
				//taxAmount: item.itemTaxTotal
			};
		});

		if (order.orderDiscounts) {
			items = _.union(items, self.getActiveDiscountItems(order.orderDiscounts));
		}


		/*if (order.shippingDiscounts) {
			items = _.union(items, getActiveDiscountItems(order.shippingDiscounts));
		}*/

		if (order.handlingDiscount) {
			items = _.union(items, self.getActiveDiscountItems(order.handlingDiscount));
		}

		//if (includeStoreCredits) {
			var storeCredits = self.getStoreCredits(order);
			if (storeCredits.length > 0) {
				items = _.union(items,storeCredits);
			}
		//}

		return items;

	},
	getShippingDiscountAmount: function (order) {
		var items = this.getActiveDiscountItems(order.shippingDiscounts);
		return _.reduce(items, function(sum, item) {return sum+item.amount;},0);
	},
	getOrderDetails: function(order, includeShipping, paymentAction, isMultishipEnabled) {
		var self = this;
		var orderDetails = {
			taxAmount: order.taxTotal || (((order.itemTaxTotal + order.shippingTaxTotal + order.handlingTaxTotal+0.00001) * 100) / 100),
			handlingAmount: (order.groupings ? (order.handlingTotal - order.handlingTaxTotal) : order.handlingTotal),
			shippingAmount: isMultishipEnabled ? (order.shippingSubTotal - order.itemLevelShippingDiscountTotal) : order.shippingSubTotal,
			shippingDiscount: isMultishipEnabled ? order.orderLevelShippingDiscountTotal : self.getShippingDiscountAmount(order),
			items: self.getItems(order, false)
		};

    	if (order.dutyTotal)
      		orderDetails.handlingAmount = (((orderDetails.handlingAmount + order.dutyTotal) * 100) / 100);

		if (paymentAction) {
			orderDetails.amount = paymentAction.amount;
			orderDetails.currencyCode = paymentAction.currencyCode;
			orderDetails.orderNumber = order.orderNumber || order.number;
		} else {
			var storeCredits = self.getStoreCredits(order);
			var storeCreditTotal = _.reduce(storeCredits, function(sum, item) {return sum+item.amount;},0);
			orderDetails.amount = ((((order.total+storeCreditTotal)+0.00001) * 100) / 100);
			orderDetails.currencyCode = order.currencyCode;
		}

		if (includeShipping)
			orderDetails.email = order.email;

		var hasNonDigital = _.find(order.items, function(item) { return item.fulfillmentMethod !== "Digital";});

		if (hasNonDigital) {
			var contact = null;

			if (order.fulfillmentInfo  && order.fulfillmentInfo.fulfillmentContact && includeShipping) {
				contact = order.fulfillmentInfo.fulfillmentContact;
			}  else if (order.destinations) {
				var itemDestinations = _.pluck(order.items,"destinationId");
				itemDestinations = _.uniq(itemDestinations);
				if (itemDestinations.length == 1) {
					var destination = _.find(order.destinations, function(destination) { return destination.id == itemDestinations[0];});
					if (destination)
						contact = destination.destinationContact;
				}
			}

			if (contact) {
				
				orderDetails.shippingAddress = {
					firstName: contact.firstName,
					lastName: contact.lastNameOrSurname,
					address1: contact.address.address1,
					address2: contact.address.address2,
					cityOrTown: contact.address.cityOrTown,
					stateOrProvince: contact.address.stateOrProvince,
					postalOrZipCode: contact.address.postalOrZipCode,
					countryCode: contact.address.countryCode,
					phone: (contact.phoneNumbers ? contact.phoneNumbers.home : "")
				};
			}

			orderDetails.requiresShipping = true;
		} else
			orderDetails.requiresShipping = false;

		//check if shipping is required
		var shipItems = _.findWhere(order.items, function(item) { return items.fulfillmentMethod === "ship"; });
		if (!shipItems)
			orderDetails.requiresShipping = false;


		return orderDetails;
	},
	getOrder: function(context, id, isCart, isMultiship) {
		console.log("isMultiShip", isMultiship);
		console.log("isCart", isCart);
		if (isCart)
			return Cart.getCart({cartId: id});
		else if (!isMultiship)
			return this.createClientFromContext(Order, context, true).getOrder({orderId: id});
		else
			return this.createClientFromContext(Checkout, context, true).getCheckout({checkoutId: id});
	}
};
