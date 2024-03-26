const { BREAKDOWNLOOKUP } = require("./constants");

exports.constructOrderDetails = (order, returnUrl, cancelUrl) => {
    const shipping = getShipping(order);
    const items = getItems(order);
    const amount = this.construsctOrderAmount(order);
    const purchaseUnit =
    {
        invoice_id: order.number,
        amount,
        shipping,
        custom_id: order.id,
        items
    };

    return {
        intent: 'AUTHORIZE',
        purchase_units: [
            purchaseUnit
        ],
        payment_source: constructPaymentSource(returnUrl, cancelUrl)
    };
};

function getItemTotal(order) {
    const currency = order.currencyCode || '';
    if (order.items) {
        const itemSum = (order.items || []).reduce((total, item) => {
            const itemTotal = parseFloat(item.amount * item.quantity);
            return parseFloat(total) + itemTotal;
        }, 0);
        return { 'item_total': currency.getAmount(itemSum) };
    }
    return {};
}

function getBreakdown(order) {
    let breakdown = {};
    const keys = Object.keys(BREAKDOWNLOOKUP);
    const currency = order.currencyCode || '';

    keys.forEach(key => {
        const value = BREAKDOWNLOOKUP[key];
        const valueInOrder = order[value];

        if (valueInOrder && valueInOrder >= 0) {
            breakdown = { ...breakdown, [key]: currency.getAmount(valueInOrder) };
        }
    });
    return breakdown;
}

exports.construsctOrderAmount = function (order) {
    const currency = order.currencyCode || '';
    const amount = currency.getAmount(order.amount);
    amount.breakdown = { ...getBreakdown(order), ...getItemTotal(order) };
    reconcileAmount(amount);
    return amount;
};

const calculateBreakdown = function (total, key, breakdown) {
    const value = parseFloat(breakdown[key].value);
    return key.includes('discount') ? total -= value : total += value;
};

function reconcileAmount({ value: total, breakdown }) {
    console.log({ breakdown });
    const sumOfBreakdown = Object.keys(breakdown).reduce((a, c) => calculateBreakdown(a, c, breakdown), 0);
    const reminder = parseFloat((total - sumOfBreakdown).toFixed(2));
    const fieldToReconcile = breakdown.tax_total || Object.keys[0];
    fieldToReconcile.value = parseFloat(fieldToReconcile.value) + reminder;
}

function constructPaymentSource(returnUrl, cancelUrl) {
    return {
        paypal: {
            experience_context: {
                return_url: returnUrl,
                cancel_url: cancelUrl
            }
        }
    };
}

String.prototype.getAmount = function (value) {
    return {
        currency_code: this.valueOf(),
        value: prepareNumber(value)
    };
};

exports.getAmount = function (value, currencyCode) {
    return {
        currency_code: currencyCode,
        value: prepareNumber(value)
    };
};

function getItems(order) {
    const currency = order.currencyCode;
    const orderItems = order.items || [];
    let items = [];
    if (orderItems && orderItems.length > 0) {
        orderItems.forEach(it => {
            const { name, quantity, amount, description } = it;
            let item = {
                name: name,
                quantity: quantity,
                description: description,
                unit_amount: currency.getAmount(amount)
            };

            items = [...items, item];
        });
    }
    return items;
}

function getShipping({ shippingAddress }) {
    if (shippingAddress) {
        const { firstName,
            lastName,
            address1,
            address2,
            cityOrTown: city,
            stateOrProvince: state,
            postalOrZipCode: postalCode,
            countryCode } = shippingAddress;
        return {
            type: 'SHIPPING', // TODO: Calculate type on the basis of shipment type.

            // TODO: Getting unsupported error. Need to check
            // name: {
            //     given_name: firstName,
            //     surname: lastName
            // },
            address: {
                address_line_1: address1,
                address_line_2: address2,
                admin_area_1: state,
                admin_area_2: city,
                postal_code: postalCode,
                country_code: countryCode
            }
        };
    }
    return null;
}

//TODO: Refactor this, This is old code
function prepareNumber(num, doubleZero) {
    var str = num.toString().replace(',', '.');
    var index = str.indexOf('.');
    if (index > -1) {
        var len = str.substring(index + 1).length;
        if (len === 1) {
            str += '0';
        }
        if (len > 2) {
            str = str.substring(0, index + 3);
        }
    } else {
        if (doubleZero || true) {
            str += '.00';
        }
    }
    return str;
}