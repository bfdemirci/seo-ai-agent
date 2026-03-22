export async function fetchSerperData(keyword) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ q: keyword, gl: "tr", hl: "tr" })
  });

  const data = await res.json();

  return {
    topResults: (data.organic || []).slice(0, 5).map(r => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet
    })),
    peopleAlsoAsk: (data.peopleAlsoAsk || []).map(q => q.question),
    relatedSearches: (data.relatedSearches || []).map(s => s.query)
  };
}
