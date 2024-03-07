// exports.getOrderDetails = (order, intent) => {
//     const currency = order.currencyCode || '';
//     let breakdown = addBreakdown(order);

//     if (order.items) {
//         const itemSum = (order.items || []).reduce((total, item) => {
//             const itemTotal = parseFloat(item.amount * item.quantity);
//             return parseFloat(total) + itemTotal;
//         }, 0);
//         breakdown = { ...breakdown, 'item_total': currency.getAmount(itemSum) }
//     }

//     const shipping = getShipping(order);
//     const items = getItems(order);
//     const amount = currency.getAmount(order.amount);
//     amount.breakdown = breakdown;

//     const purchaseUnit =
//     {
//         invoice_id: order.number,
//         amount,
//         shipping,
//         custom_id: order.id,
//         items
//     }

//     return {
//         intent,
//         purchase_units: [
//             purchaseUnit
//         ]
//     }
// }

// function addBreakdown(order) {
//     let breakdown = {};
//     const keys = Object.keys(breakdownLookup);
//     const currency = order.currencyCode || '';

//     keys.forEach(key => {
//         const value = breakdownLookup[key];
//         const valueInOrder = order[value];

//         if (valueInOrder) {
//             breakdown = { ...breakdown, [key]: currency.getAmount(valueInOrder) }
//         }
//     })
//     return breakdown;
// }

// String.prototype.getAmount = function (value) {
//     return {
//         currency_code: this.valueOf(),
//         value: prepareNumber(value)
//     }
// }

// function getItems(order) {
//     const currency = order.currencyCode;
//     const orderItems = order.items || [];
//     const items = [];
//     if (orderItems && orderItems.length > 0) {
//         orderItems.forEach(it => {
//             const { name, quantity, amount, description } = it;
//             let item = {
//                 name: name,
//                 quantity: quantity,
//                 description: description,
//                 unit_amount: currency.getAmount(amount)
//             }

//             items = [...items, item];
//         })

//     }
//     return items;
// }

// function getShipping({ shippingAddress }) {
//     if (shippingAddress) {
//         const { firstName,
//             lastName,
//             address1,
//             address2,
//             cityOrTown: city,
//             stateOrProvince: state,
//             postalOrZipCode: postalCode,
//             countryCode } = shippingAddress;
//         return {
//             type: 'SHIPPING', // TODO: Calculate type on the basis of shipment type.
//             name: {
//                 given_name: firstName,
//                 surname: lastName
//             },
//             address: {
//                 address_line_1: address1,
//                 address_line_2: address2,
//                 admin_area_1: state,
//                 admin_area_2: city,
//                 postal_code: postalCode,
//                 country_code: countryCode
//             }
//         }
//     }
//     return null;
// }

// //TODO: refactor this
// function prepareNumber(num, doubleZero) {
//     var str = num.toString().replace(',', '.');
//     var index = str.indexOf('.');
//     if (index > -1) {
//         var len = str.substring(index + 1).length;
//         if (len === 1) {
//             str += '0';
//         }
//         if (len > 2) {
//             str = str.substring(0, index + 3);
//         }
//     } else {
//         if (doubleZero || true) {
//             str += '.00';
//         }
//     }
//     return str;
// }

// const breakdownLookup = {
//     shipping: 'shippingAmount',
//     tax_total: 'taxAmount',
//     shipping_discount: 'shippingDiscount',
//     handling: 'handlingAmount',
//     item_total: 'items'
// };