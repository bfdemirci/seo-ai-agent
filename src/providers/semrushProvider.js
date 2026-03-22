import https from 'https';

const MOCK = {
  volume: 5400, keywordDifficulty: 62, cpc: 0.45, competition: 0.7,
  relatedKeywords: [
    { keyword: 'seo ne demek',     volume: 2400, difficulty: 55 },
    { keyword: 'seo nasil yapilir', volume: 3600, difficulty: 68 },
  ],
  competitors: [
    { domain: 'example.com', trafficEstimate: 12000 },
    { domain: 'sample.com',  trafficEstimate: 9500  },
  ],
};

function httpGet(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ _raw: body }); }
      });
    }).on('error', reject);
  });
}

export async function fetchKeywordOverview(keyword, _injected) {
  if (_injected && _injected.fetcher) {
    return _injected.fetcher(keyword, process.env.SEMRUSH_API_KEY);
  }
  var apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) {
    return Object.assign({ keyword: keyword, _mock: true }, MOCK);
  }
  try {
    var enc = encodeURIComponent(keyword);
    var url = 'https://api.semrush.com/?type=phrase_this&key=' + apiKey + '&phrase=' + enc + '&export_columns=Ph,Nq,Cp,Co,Nr,Kd&database=tr&display_limit=1';
    return await httpGet(url);
  } catch (err) {
    return Object.assign({ keyword: keyword, _mock: true, _error: err.message }, MOCK);
  }
}
