#PayPal Express Integration for Mozu (Using Arc.js)
###Version 1.1.0

The [PayPal Express](https://developer.paypal.com/docs/classic/products/express-checkout/) Integration for Mozu uses the [Arc.js](http://developer.mozu.com/content/arcjs/Arcjs_Intro.htm) framework to create custom actions that enable merchants to add PayPal’s Express Checkout functionality to sites on the Mozu platform. This readme describes how to use the code in this repository to enable PayPal Express on your Mozu site.

**Note:** The instructions in this readme only apply if you have Arc.js enabled and are integrating this application in-house. Contact your Mozu representative to enable Arc.js on your tenant. If you installed the PayPal Express Certified Mozu Application, you do not need to build this app. You can go directly to the [theme repository](https://github.com/Mozu/PayPalExpress-Theme) to apply the necessary updates to your Mozu theme.


## Requirements

Review the following requirements to ensure you have everything you need to successfully build this application: 

 - A Developer Account at [mozu.com](http://mozu.com/login) with the Arc.js framework enabled.
 - A Sandbox connected to the Developer Account, with code actions enabled.
 - NodeJS v0.12 or later.
 - The following global NPM packages installed:
    - `yo`
    - `grunt-cli`
    - `generator-mozu-app`
   You can install all of these at once from the command prompt with the following command:
   ```sh
   npm i -g yo grunt-cli generator-mozu-app
   ```

## Setup

1. Clone this repository to a folder on your development machine:
   ```sh
   git clone https://github.com/Mozu/PayPal-Express.git
   
   Cloning into './PayPal-Express'...
   done.
   ```

2. Login to the Mozu Developer Center and create a new app. Call it "PayPal Express Checkout" and make a note of its Application Key.

3. Now you're prepared to generate your upload configuration. Have on hand:
    - The application key for the app you just created.
    - Your Developer Center login credentials.
   In the `PayPal-Express` directory you cloned from Git, run:
   ```sh
   yo mozu-app --config
   ```
   You will be prompted to enter all the necessary information.

4. Once that is complete, run `npm install`:
   ```sh
   npm install
   ```
   to download the necessary dependencies.

5. You're ready to sync! Run `grunt`:
   ```sh
   grunt
   ```
   to upload the actions to Developer Center. You can also run:
   ```sh
   grunt watch
   ```
   to continuously upload changes as you work. Grunt detects the file changes automatically.

## Install the App

Now that you've uploaded the code to your PayPal Express Checkout app, it's ready to install in your sandbox. 

1. Go to the app details page in Developer Center and click the **Install** button. 
2. In the dialog that appears, select your sandbox and click **Install**.
*If the install process fails at this point, check with Mozu Support to make sure that the Arc.js framework is enabled for your sandbox.*
3. View your sandbox.
 
## Configure the App

**Note:** More detailed configuration instructions are available in the [PayPal Express Configuration Guide](http://mozu.github.io/IntegrationDocuments/PayPalExpress/Mozu-PayPalExpress-App.htm).

In Mozu Admin, select **Settings** > **Payment & Checkout**. You should see a new **PayPal Express2** option. Enable the checkbox to configure Mozu with your PayPal account settings. The following settings are required for PayPalExpress2 to work:
  - UserName
  - Password
  - Signature
  - Merchant account ID
  - Order Processing

**Note:** You can add additonal settings by modifying `src/paltform.applications/embedded.platform.applications.install.js`.

## Merge Theme Changes

Installing and configuring the PayPal Express Checkout app enables PayPal Express functionality in Mozu Admin. To enable PayPal Express Checkout on your storefront so that customers can use PayPal Express as a payment method, you must also merge theme changes to enable the PayPal workflow. 

Mozu provides sample implementations of the required changes in the [PayPalExpress-Theme](https://github.com/Mozu/PayPalExpress-Theme.git) repository. The theme repository includes multiple branches for different versions of the Mozu Core Theme.

To update your theme to support PayPal Express Checkout, review the changes made in our sample implementation and apply them to your own theme. 

For more information on working with themes, including modifying, uploading, installing, and applying the theme to your site, see the [Theme Development documentation](http://developer.mozu.com/content/learn/themedev/theme-development.htm).


## Payment Code Actions

The following are the actions for which `embedded.commerce.payments.action.performPaymentInteraction` is invoked:
- CreatePayment
- AuthorizePayment
- CapturePayment
- CreditPayment
- DeclinePayment
- Rollback
- VoidPayment

After the payment interaction has been processed, one of the following states can be passed back to the system:
- Authorized
- Captured
- Declined
- Failed (set this state to terminate payment flow)
- Voided
- Credited
- New
- RolledBack

##Additional Resources
* [PayPal Express Theme Integration for Mozu Core](https://github.com/Mozu/PayPalExpress-Theme) (Theme Repo)
* [PayPal Express Configuration Guide](http://mozu.github.io/IntegrationDocuments/PayPalExpress/Mozu-PayPalExpress-App.htm) (App Documentation)
* [Mozu Theme Development Quickstart](http://developer.mozu.com/content/learn/themedev/quickstart/create-your-first-theme.htm) (Mozu Documentation)
* [Intro to Arc.js](http://developer.mozu.com/content/arcjs/Arcjs_Intro.htm) (Mozu Documentation)
* [Comparing commits across time](https://help.github.com/articles/comparing-commits-across-time/) (GitHub Help) 
