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