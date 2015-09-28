(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.index = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = {
  
  'embedded.commerce.orders.action.after': {
      actionName:'embedded.commerce.orders.action.after',
      customFunction: require('./domains/commerce.orders/embedded.commerce.orders.action.after')
   }
  
};
},{"./domains/commerce.orders/embedded.commerce.orders.action.after":2}],2:[function(require,module,exports){
/**
 * Implementation for embedded.commerce.orders.action.after
 * This function will receive the following context object:

{
  &#34;exec&#34;: {
    &#34;setItemAllocation&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;allocationId&#34;,
          &#34;type&#34;: &#34;number&#34;
        },
        {
          &#34;name&#34;: &#34;expiration&#34;,
          &#34;type&#34;: &#34;date&#34;
        },
        {
          &#34;name&#34;: &#34;productCode&#34;,
          &#34;type&#34;: &#34;string&#34;
        },
        {
          &#34;name&#34;: &#34;itemId&#34;,
          &#34;type&#34;: &#34;string&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.orderItem&#34;
      }
    },
    &#34;setAttribute&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;fqn&#34;,
          &#34;type&#34;: &#34;string&#34;
        },
        {
          &#34;name&#34;: &#34;values&#34;,
          &#34;type&#34;: &#34;object&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.order&#34;
      }
    },
    &#34;removeAttribute&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;fqn&#34;,
          &#34;type&#34;: &#34;string&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.order&#34;
      }
    },
    &#34;setData&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;key&#34;,
          &#34;type&#34;: &#34;string&#34;
        },
        {
          &#34;name&#34;: &#34;value&#34;,
          &#34;type&#34;: &#34;object&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.order&#34;
      }
    },
    &#34;removeData&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;key&#34;,
          &#34;type&#34;: &#34;string&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.order&#34;
      }
    },
    &#34;setItemData&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;key&#34;,
          &#34;type&#34;: &#34;string&#34;
        },
        {
          &#34;name&#34;: &#34;value&#34;,
          &#34;type&#34;: &#34;object&#34;
        },
        {
          &#34;name&#34;: &#34;itemId&#34;,
          &#34;type&#34;: &#34;string&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.orderItem&#34;
      }
    },
    &#34;removeItemData&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;key&#34;,
          &#34;type&#34;: &#34;string&#34;
        },
        {
          &#34;name&#34;: &#34;itemId&#34;,
          &#34;type&#34;: &#34;string&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.orderItem&#34;
      }
    },
    &#34;setDutyAmount&#34;: {
      &#34;parameters&#34;: [
        {
          &#34;name&#34;: &#34;dutyAmount&#34;,
          &#34;type&#34;: &#34;number&#34;
        }
      ],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.order.order&#34;
      }
    }
  },
  &#34;get&#34;: {
    &#34;order&#34;: {
      &#34;parameters&#34;: [],
      &#34;return&#34;: {
        &#34;type&#34;: &#34;mozu.commerceRuntime.contracts.orders.order&#34;
      }
    }
  }
}

 */

module.exports = function(context, callback) {
  callback();
};
},{}]},{},[1])(1)
});