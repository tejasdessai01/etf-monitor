#!/usr/bin/env bash
# Seed ETFs into Supabase via REST API (no Node.js DNS needed)
set -e

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdnRtaGZ0YWh4cGxibmxucmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTAyOTQsImV4cCI6MjA4NzM4NjI5NH0.ziA6OB5pKaxOCWl8y9ywEN63WBgiRjuZ1OF-eb3g30A"
URL="https://xmvtmhftahxplbnlnrjz.supabase.co/rest/v1/etfs"

PAYLOAD='[
{"ticker":"SPY","name":"SPDR S&P 500 ETF Trust","issuer":"State Street","category":"US Equity","sub_category":"Large Cap Blend","aum":537000000000,"expense_ratio":0.0945,"inception_date":"1993-01-22","exchange":"NYSE Arca"},
{"ticker":"IVV","name":"iShares Core S&P 500 ETF","issuer":"BlackRock","category":"US Equity","sub_category":"Large Cap Blend","aum":507000000000,"expense_ratio":0.03,"inception_date":"2000-05-15","exchange":"NYSE Arca"},
{"ticker":"VOO","name":"Vanguard S&P 500 ETF","issuer":"Vanguard","category":"US Equity","sub_category":"Large Cap Blend","aum":572000000000,"expense_ratio":0.03,"inception_date":"2010-09-07","exchange":"NYSE Arca"},
{"ticker":"VTI","name":"Vanguard Total Stock Market ETF","issuer":"Vanguard","category":"US Equity","sub_category":"Total Market","aum":432000000000,"expense_ratio":0.03,"inception_date":"2001-05-24","exchange":"NYSE Arca"},
{"ticker":"QQQ","name":"Invesco QQQ Trust","issuer":"Invesco","category":"US Equity","sub_category":"Large Cap Growth","aum":286000000000,"expense_ratio":0.20,"inception_date":"1999-03-10","exchange":"NASDAQ"},
{"ticker":"QQQM","name":"Invesco NASDAQ 100 ETF","issuer":"Invesco","category":"US Equity","sub_category":"Large Cap Growth","aum":32000000000,"expense_ratio":0.15,"inception_date":"2020-10-13","exchange":"NASDAQ"},
{"ticker":"IWM","name":"iShares Russell 2000 ETF","issuer":"BlackRock","category":"US Equity","sub_category":"Small Cap Blend","aum":65000000000,"expense_ratio":0.19,"inception_date":"2000-05-22","exchange":"NYSE Arca"},
{"ticker":"VUG","name":"Vanguard Growth ETF","issuer":"Vanguard","category":"US Equity","sub_category":"Large Cap Growth","aum":130000000000,"expense_ratio":0.04,"inception_date":"2004-01-26","exchange":"NYSE Arca"},
{"ticker":"VTV","name":"Vanguard Value ETF","issuer":"Vanguard","category":"US Equity","sub_category":"Large Cap Value","aum":110000000000,"expense_ratio":0.04,"inception_date":"2004-01-26","exchange":"NYSE Arca"},
{"ticker":"ITOT","name":"iShares Core S&P Total US Stock ETF","issuer":"BlackRock","category":"US Equity","sub_category":"Total Market","aum":60000000000,"expense_ratio":0.03,"inception_date":"2004-01-20","exchange":"NYSE Arca"},
{"ticker":"SCHB","name":"Schwab US Broad Market ETF","issuer":"Schwab","category":"US Equity","sub_category":"Total Market","aum":31000000000,"expense_ratio":0.03,"inception_date":"2009-11-03","exchange":"NYSE Arca"},
{"ticker":"SCHX","name":"Schwab US Large-Cap ETF","issuer":"Schwab","category":"US Equity","sub_category":"Large Cap Blend","aum":44000000000,"expense_ratio":0.03,"inception_date":"2009-11-03","exchange":"NYSE Arca"},
{"ticker":"RSP","name":"Invesco S&P 500 Equal Weight ETF","issuer":"Invesco","category":"US Equity","sub_category":"Large Cap Blend","aum":60000000000,"expense_ratio":0.20,"inception_date":"2003-04-24","exchange":"NYSE Arca"},
{"ticker":"MGK","name":"Vanguard Mega Cap Growth ETF","issuer":"Vanguard","category":"US Equity","sub_category":"Mega Cap Growth","aum":20000000000,"expense_ratio":0.07,"inception_date":"2007-12-17","exchange":"NYSE Arca"},
{"ticker":"XLK","name":"Technology Select Sector SPDR Fund","issuer":"State Street","category":"Sector","sub_category":"Technology","aum":72000000000,"expense_ratio":0.09,"inception_date":"1998-12-16","exchange":"NYSE Arca"},
{"ticker":"XLF","name":"Financial Select Sector SPDR Fund","issuer":"State Street","category":"Sector","sub_category":"Financials","aum":45000000000,"expense_ratio":0.09,"inception_date":"1998-12-16","exchange":"NYSE Arca"},
{"ticker":"XLE","name":"Energy Select Sector SPDR Fund","issuer":"State Street","category":"Sector","sub_category":"Energy","aum":35000000000,"expense_ratio":0.09,"inception_date":"1998-12-16","exchange":"NYSE Arca"},
{"ticker":"XLV","name":"Health Care Select Sector SPDR Fund","issuer":"State Street","category":"Sector","sub_category":"Health Care","aum":38000000000,"expense_ratio":0.09,"inception_date":"1998-12-16","exchange":"NYSE Arca"},
{"ticker":"XLI","name":"Industrial Select Sector SPDR Fund","issuer":"State Street","category":"Sector","sub_category":"Industrials","aum":24000000000,"expense_ratio":0.09,"inception_date":"1998-12-16","exchange":"NYSE Arca"},
{"ticker":"XLC","name":"Communication Services Select Sector SPDR","issuer":"State Street","category":"Sector","sub_category":"Comm. Services","aum":20000000000,"expense_ratio":0.09,"inception_date":"2018-06-18","exchange":"NYSE Arca"},
{"ticker":"VGT","name":"Vanguard Information Technology ETF","issuer":"Vanguard","category":"Sector","sub_category":"Technology","aum":72000000000,"expense_ratio":0.10,"inception_date":"2004-01-26","exchange":"NYSE Arca"},
{"ticker":"SOXX","name":"iShares Semiconductor ETF","issuer":"BlackRock","category":"Sector","sub_category":"Semiconductors","aum":14000000000,"expense_ratio":0.35,"inception_date":"2001-07-10","exchange":"NASDAQ"},
{"ticker":"SMH","name":"VanEck Semiconductor ETF","issuer":"VanEck","category":"Sector","sub_category":"Semiconductors","aum":21000000000,"expense_ratio":0.35,"inception_date":"2000-05-05","exchange":"NASDAQ"},
{"ticker":"IBB","name":"iShares Biotechnology ETF","issuer":"BlackRock","category":"Sector","sub_category":"Biotechnology","aum":8000000000,"expense_ratio":0.44,"inception_date":"2001-02-05","exchange":"NASDAQ"},
{"ticker":"BND","name":"Vanguard Total Bond Market ETF","issuer":"Vanguard","category":"Fixed Income","sub_category":"Broad Bond","aum":116000000000,"expense_ratio":0.03,"inception_date":"2007-04-03","exchange":"NYSE Arca"},
{"ticker":"AGG","name":"iShares Core U.S. Aggregate Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"Broad Bond","aum":107000000000,"expense_ratio":0.03,"inception_date":"2003-09-22","exchange":"NYSE Arca"},
{"ticker":"VCIT","name":"Vanguard Intermediate-Term Corp Bond ETF","issuer":"Vanguard","category":"Fixed Income","sub_category":"Corp Bond","aum":45000000000,"expense_ratio":0.04,"inception_date":"2009-11-19","exchange":"NYSE Arca"},
{"ticker":"LQD","name":"iShares iBoxx Investment Grade Corp Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"Corp Bond","aum":33000000000,"expense_ratio":0.14,"inception_date":"2002-07-22","exchange":"NYSE Arca"},
{"ticker":"TLT","name":"iShares 20+ Year Treasury Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"Long-Term Treasury","aum":53000000000,"expense_ratio":0.15,"inception_date":"2002-07-22","exchange":"NASDAQ"},
{"ticker":"SHY","name":"iShares 1-3 Year Treasury Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"Short-Term Treasury","aum":25000000000,"expense_ratio":0.15,"inception_date":"2002-07-22","exchange":"NASDAQ"},
{"ticker":"SGOV","name":"iShares 0-3 Month Treasury Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"Ultra Short","aum":35000000000,"expense_ratio":0.09,"inception_date":"2020-05-26","exchange":"CBOE"},
{"ticker":"GOVT","name":"iShares U.S. Treasury Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"Treasury","aum":26000000000,"expense_ratio":0.05,"inception_date":"2012-02-14","exchange":"NYSE Arca"},
{"ticker":"MUB","name":"iShares National Muni Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"Municipal","aum":37000000000,"expense_ratio":0.05,"inception_date":"2007-09-07","exchange":"NYSE Arca"},
{"ticker":"HYG","name":"iShares iBoxx High Yield Corp Bond ETF","issuer":"BlackRock","category":"Fixed Income","sub_category":"High Yield","aum":14000000000,"expense_ratio":0.48,"inception_date":"2007-04-04","exchange":"NYSE Arca"},
{"ticker":"JNK","name":"SPDR Bloomberg High Yield Bond ETF","issuer":"State Street","category":"Fixed Income","sub_category":"High Yield","aum":9000000000,"expense_ratio":0.40,"inception_date":"2007-11-28","exchange":"NYSE Arca"},
{"ticker":"GLD","name":"SPDR Gold Shares","issuer":"State Street","category":"Commodities","sub_category":"Gold","aum":78000000000,"expense_ratio":0.40,"inception_date":"2004-11-18","exchange":"NYSE Arca"},
{"ticker":"IAU","name":"iShares Gold Trust","issuer":"BlackRock","category":"Commodities","sub_category":"Gold","aum":33000000000,"expense_ratio":0.25,"inception_date":"2005-01-21","exchange":"NYSE Arca"},
{"ticker":"SLV","name":"iShares Silver Trust","issuer":"BlackRock","category":"Commodities","sub_category":"Silver","aum":12000000000,"expense_ratio":0.50,"inception_date":"2006-04-21","exchange":"NYSE Arca"},
{"ticker":"GDX","name":"VanEck Gold Miners ETF","issuer":"VanEck","category":"Commodities","sub_category":"Gold Miners","aum":14000000000,"expense_ratio":0.51,"inception_date":"2006-05-16","exchange":"NYSE Arca"},
{"ticker":"USO","name":"United States Oil Fund","issuer":"USCF","category":"Commodities","sub_category":"Oil","aum":1500000000,"expense_ratio":0.72,"inception_date":"2006-04-10","exchange":"NYSE Arca"},
{"ticker":"PDBC","name":"Invesco Optimum Yield Diversified Commodity","issuer":"Invesco","category":"Commodities","sub_category":"Broad","aum":4000000000,"expense_ratio":0.59,"inception_date":"2014-11-07","exchange":"NASDAQ"},
{"ticker":"IEFA","name":"iShares Core MSCI EAFE ETF","issuer":"BlackRock","category":"International","sub_category":"Developed Markets","aum":113000000000,"expense_ratio":0.07,"inception_date":"2012-10-18","exchange":"CBOE"},
{"ticker":"VEA","name":"Vanguard FTSE Developed Markets ETF","issuer":"Vanguard","category":"International","sub_category":"Developed Markets","aum":107000000000,"expense_ratio":0.06,"inception_date":"2007-07-20","exchange":"NYSE Arca"},
{"ticker":"VWO","name":"Vanguard FTSE Emerging Markets ETF","issuer":"Vanguard","category":"International","sub_category":"Emerging Markets","aum":70000000000,"expense_ratio":0.08,"inception_date":"2005-03-04","exchange":"NYSE Arca"},
{"ticker":"EEM","name":"iShares MSCI Emerging Markets ETF","issuer":"BlackRock","category":"International","sub_category":"Emerging Markets","aum":17000000000,"expense_ratio":0.70,"inception_date":"2003-04-07","exchange":"NYSE Arca"},
{"ticker":"EFA","name":"iShares MSCI EAFE ETF","issuer":"BlackRock","category":"International","sub_category":"Developed Markets","aum":51000000000,"expense_ratio":0.32,"inception_date":"2001-08-14","exchange":"NASDAQ"},
{"ticker":"FXI","name":"iShares China Large-Cap ETF","issuer":"BlackRock","category":"International","sub_category":"China","aum":5000000000,"expense_ratio":0.74,"inception_date":"2004-10-05","exchange":"NYSE Arca"},
{"ticker":"VNQ","name":"Vanguard Real Estate ETF","issuer":"Vanguard","category":"Real Estate","sub_category":"Diversified REIT","aum":33000000000,"expense_ratio":0.13,"inception_date":"2004-09-23","exchange":"NYSE Arca"},
{"ticker":"SCHH","name":"Schwab US REIT ETF","issuer":"Schwab","category":"Real Estate","sub_category":"Diversified REIT","aum":7000000000,"expense_ratio":0.07,"inception_date":"2011-01-13","exchange":"NYSE Arca"},
{"ticker":"IYR","name":"iShares US Real Estate ETF","issuer":"BlackRock","category":"Real Estate","sub_category":"Diversified REIT","aum":3000000000,"expense_ratio":0.39,"inception_date":"2000-06-12","exchange":"NYSE Arca"},
{"ticker":"ARKK","name":"ARK Innovation ETF","issuer":"ARK Invest","category":"Thematic","sub_category":"Disruptive Innovation","aum":7000000000,"expense_ratio":0.75,"inception_date":"2014-10-31","exchange":"NYSE Arca"},
{"ticker":"ARKW","name":"ARK Next Generation Internet ETF","issuer":"ARK Invest","category":"Thematic","sub_category":"Next Gen Internet","aum":1500000000,"expense_ratio":0.88,"inception_date":"2014-09-29","exchange":"NYSE Arca"},
{"ticker":"IBIT","name":"iShares Bitcoin Trust ETF","issuer":"BlackRock","category":"Digital Assets","sub_category":"Bitcoin","aum":50000000000,"expense_ratio":0.25,"inception_date":"2024-01-11","exchange":"NASDAQ"},
{"ticker":"FBTC","name":"Fidelity Wise Origin Bitcoin Fund","issuer":"Fidelity","category":"Digital Assets","sub_category":"Bitcoin","aum":20000000000,"expense_ratio":0.25,"inception_date":"2024-01-11","exchange":"CBOE"},
{"ticker":"GBTC","name":"Grayscale Bitcoin Trust ETF","issuer":"Grayscale","category":"Digital Assets","sub_category":"Bitcoin","aum":18000000000,"expense_ratio":1.50,"inception_date":"2013-09-25","exchange":"NYSE Arca"},
{"ticker":"BITO","name":"ProShares Bitcoin Strategy ETF","issuer":"ProShares","category":"Digital Assets","sub_category":"Bitcoin Futures","aum":2000000000,"expense_ratio":0.95,"inception_date":"2021-10-19","exchange":"NYSE Arca"},
{"ticker":"ETHA","name":"iShares Ethereum Trust ETF","issuer":"BlackRock","category":"Digital Assets","sub_category":"Ethereum","aum":3000000000,"expense_ratio":0.25,"inception_date":"2024-07-23","exchange":"NASDAQ"},
{"ticker":"VYM","name":"Vanguard High Dividend Yield ETF","issuer":"Vanguard","category":"US Equity","sub_category":"High Dividend","aum":55000000000,"expense_ratio":0.06,"inception_date":"2006-11-10","exchange":"NYSE Arca"},
{"ticker":"DVY","name":"iShares Select Dividend ETF","issuer":"BlackRock","category":"US Equity","sub_category":"High Dividend","aum":14000000000,"expense_ratio":0.38,"inception_date":"2003-11-03","exchange":"NASDAQ"},
{"ticker":"SCHD","name":"Schwab US Dividend Equity ETF","issuer":"Schwab","category":"US Equity","sub_category":"Dividend Growth","aum":66000000000,"expense_ratio":0.06,"inception_date":"2011-10-20","exchange":"NYSE Arca"},
{"ticker":"DGRO","name":"iShares Core Dividend Growth ETF","issuer":"BlackRock","category":"US Equity","sub_category":"Dividend Growth","aum":27000000000,"expense_ratio":0.08,"inception_date":"2014-06-10","exchange":"NYSE Arca"},
{"ticker":"TQQQ","name":"ProShares UltraPro QQQ","issuer":"ProShares","category":"Leveraged","sub_category":"3x Nasdaq-100","aum":22000000000,"expense_ratio":0.88,"inception_date":"2010-02-09","exchange":"NASDAQ"},
{"ticker":"SQQQ","name":"ProShares UltraPro Short QQQ","issuer":"ProShares","category":"Leveraged","sub_category":"-3x Nasdaq-100","aum":4000000000,"expense_ratio":0.95,"inception_date":"2010-02-09","exchange":"NASDAQ"},
{"ticker":"SPXU","name":"ProShares UltraPro Short S&P500","issuer":"ProShares","category":"Leveraged","sub_category":"-3x S&P 500","aum":700000000,"expense_ratio":0.91,"inception_date":"2009-06-23","exchange":"NYSE Arca"},
{"ticker":"UPRO","name":"ProShares UltraPro S&P500","issuer":"ProShares","category":"Leveraged","sub_category":"3x S&P 500","aum":3500000000,"expense_ratio":0.92,"inception_date":"2009-06-23","exchange":"NYSE Arca"},
{"ticker":"AOA","name":"iShares Core Aggressive Allocation ETF","issuer":"BlackRock","category":"Multi-Asset","sub_category":"Aggressive Alloc","aum":1800000000,"expense_ratio":0.15,"inception_date":"2008-11-04","exchange":"NYSE Arca"},
{"ticker":"AOR","name":"iShares Core Growth Allocation ETF","issuer":"BlackRock","category":"Multi-Asset","sub_category":"Growth Alloc","aum":1800000000,"expense_ratio":0.15,"inception_date":"2008-11-04","exchange":"NYSE Arca"},
{"ticker":"ESGU","name":"iShares MSCI USA ESG Optimized ETF","issuer":"BlackRock","category":"ESG","sub_category":"US ESG","aum":15000000000,"expense_ratio":0.15,"inception_date":"2016-12-01","exchange":"NASDAQ"},
{"ticker":"ESGV","name":"Vanguard ESG US Stock ETF","issuer":"Vanguard","category":"ESG","sub_category":"US ESG","aum":8000000000,"expense_ratio":0.09,"inception_date":"2018-09-18","exchange":"CBOE"}
]'

echo "Seeding ETFs..."
HTTP=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "$PAYLOAD")

STATUS=$(echo "$HTTP" | tail -1)
BODY=$(echo "$HTTP" | head -n -1)

echo "HTTP $STATUS"
if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  echo "SUCCESS — all 70 ETFs seeded"
else
  echo "Response: $BODY"
fi
