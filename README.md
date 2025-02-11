# Binance-volatility-trading-bot-JS

## Changes in this fork

- TEST_MODE, TRAILING_MODE are environment variables now.

- yarn lock file, instead of npm.

- Added Dockerfile. https://hub.docker.com/repository/docker/alsteant/binance-bot

- BUY_DIPS_MODE.

- Close old positions.

## TODO

- Use ccxt for all API calls.

- Support other exchanges.

## Notes

- Use this bot at your own risk.

- Save the planet. Refrain from doing on-chain transactions with proof-of-work
  coins, such as Bitcoin.

# README from forked repo starts here

I take the idea from <a href="https://github.com/CyberPunkMetalHead/Binance-volatility-trading-bot"> this project</a>. The original bot is written in Python. I quite like it so I re-write it in Java Script to fix some issues and add some improvements. Shoutout to <a href="https://github.com/CyberPunkMetalHead"> CyberPunkMetalHead</a> for such an awesome contribution

Here's the main functions of the bot:

1. Listen to the prices on Binance for every interval of 4 minutes.
2. Figure out which coin's price has increase by 3% in each interval and proceed to buy.
3. Track the bought assets' prices every interval, sell at 6% profit or 3% stop loss.
4. If you choose to keep holding the asset when it hits TP, that's possible in [TRAILING_MODE](#trailing-desc)
5. Record sold assets so users can see which coins were sold at what profit, so they can refine variables and automatically exclude some pairs when trading.

All the of the variables: Budget, Interval, Take profit or Stop loss thresholds, The change in price to trigger the buy function... are configurable by the users

# Installation

1. Requirements:
<ul>
    <li>
        <a href="https://nodejs.org/en/download/">Node JS</a>
    </li>
</ul>

2. Download the project <a href="https://github.com/21jake/Binance-volatility-trading-bot-JS.git">here</a>
3. Open the terminal at the root folder, run

   > npm install

   to install necessary packages

4. Create a new config.env file based on the config.env.example file at the root folder. Place your configurations there. <b>Again, whoever has this file can place orders from your account</b>
   <br/>
   To retrieve your Binance API Key and Secret on both Testnet and Mainnet, I find no better guide than this one over <a href="https://www.cryptomaton.org/2021/05/08/how-to-code-a-binance-trading-bot-that-detects-the-most-volatile-coins-on-binance/">here</a>

5. The bot is default to run on the Testnet. If you want to switch to Mainnet, set the TEST_MODE constant (in the constants.js file) to false

   > const TEST_MODE = false;

6. Finally, to start the script, open your terminal and run

   > npm run start

7. To stop the bot, hit Ctrl + C combination in the terminal

# Notes

1. Create a config.env file in the root folder and place your configurations there. <b>For the love of God don't expose this file since it contains your API keys</b>.
2. If you set the budget (QUANTITY) of 50 USDT, the bot will not spend more than 50 USDT on trading (It checks the current portfolio first before making the purchase decision).
3. If the inital QUANTITY is 50 USDT and there are 2 coins to buy in that interval, the bot allocates 25 USDT for each coin order.
4. <span id="trailing-desc">If</span> the inital QUANTITY is 50 USDT and there is one asset worths 30 USDT in the portfolio, the bot will spend 20 USDT for following orders.
5. The bot is default to sell 99.5% of the bought amount. The reason is sometimes you can't sell 100% of an asset on Binance. If you have some BNBs to pay for transactions then you can set the 99.5% ratio to 100%. This is configurable.
6. Generally, you better place an order with at least 11 USDT to be accepted by Binance.
7. <a>TRAILING MODE DESCRIPTION:</a><br/>
   This mode runs by default.
   Every time an asset hits the TP, the bot doesn't sell it immediately.
   The SL and TP threshold of that asset is increased.
   If an asset hits the SL, we sell (In fact, we just sell at SL).

   For example, BTCUSDT is bought at 100. TP is 106 (6%) and SL is 97 (3%).
   When it hits 106, the TP is adjusted to ~109 and SL is ~103.
   Whenever it hits SL (97 or 103...), the bot sells.

   Disable this feature by setting "TRAILING_MODE" (in the constants.js file) to false

8. <a>SAFE_MODE DESCRIPTION:</a><br/>
   This mode runs by default.
   To avoid the rapid ups and immediate downs within the next interval,
   after an asset is bought, the bot scan to check the asset price every 1 minute
   (1 is the default value, you can change the SCAN_INTERVAL in the config.env file).
   If the asset price hits SL threshold during that 1 minute, the bot will proceed to sell the asset.

   Disable this feature by setting "SAFE_MODE" (in the constants.js file) to false

# Contribution

If you run into some issues or have some suggestions, feel free to open an issue at the project's repo. I would be more than happy to read/approve some pull requests :).
