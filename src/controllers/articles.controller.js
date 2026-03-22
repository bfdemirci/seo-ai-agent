import { ok, notFound, serverError, badRequest } from '../services/api/responseBuilder.js';
import { parsePagination, buildPagination } from '../services/api/pagination.js';
import {
  listArticles, getArticleById, getArticleByKeyword,
  updateCurrentVersion, updateArticleMetadata,
} from '../repositories/articleRepository.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var STORAGE   = path.resolve(__dirname, '..', '..', 'storage', 'articles');

export function getArticles(req, res) {
  try {
    var { limit, offset } = parsePagination(req.query);
    var q      = (req.query.q || '').toLowerCase().trim();
    var status = (req.query.status || '').trim();
    var all = listArticles({ limit: 500 });
    if (q)      all = all.filter(function(m){ return (m.keyword||'').toLowerCase().includes(q); });
    if (status) all = all.filter(function(m){ return m.status === status; });
    var total = all.length;
    var items = all.slice(offset, offset + limit);
    return ok(res, { items, pagination: buildPagination(total, limit, offset) });
  } catch (err) { return serverError(res, err.message); }
}

export function getArticle(req, res) {
  try {
    var rec = getArticleById(req.params.articleId);
    if (!rec) return notFound(res, 'Article not found: ' + req.params.articleId);
    var events = (rec.meta && rec.meta.events) || rec.events || [];
    return ok(res, Object.assign({}, rec, { events: events }));
  } catch (err) { return serverError(res, err.message); }
}

export function getVersions(req, res) {
  try {
    var articleId = req.params.articleId;
    var rec = getArticleById(articleId);
    if (!rec) return notFound(res, 'Article not found');
    var vDir = path.join(STORAGE, articleId, 'versions');
    var versions = [];
    if (fs.existsSync(vDir)) {
      versions = fs.readdirSync(vDir)
        .filter(function(f){ return /^v\d+\.json$/.test(f); })
        .map(function(f){
          var v = f.replace('.json','');
          try {
            var d = JSON.parse(fs.readFileSync(path.join(vDir,f),'utf8'));
            return { version: v, createdAt: d.createdAt || null, label: d.label || null };
          } catch(_){ return { version: v, createdAt: null, label: null }; }
        })
        .sort(function(a,b){ return a.version.localeCompare(b.version,undefined,{numeric:true}); });
    }
    return ok(res, { articleId, currentVersion: rec.meta.currentVersion, versions });
  } catch (err) { return serverError(res, err.message); }
}

export function getVersion(req, res) {
  try {
    var { articleId, version } = req.params;
    var fp = path.join(STORAGE, articleId, 'versions', version + '.json');
    if (!fs.existsSync(fp)) return notFound(res, 'Version not found: ' + version);
    var data = JSON.parse(fs.readFileSync(fp,'utf8'));
    return ok(res, { articleId, version, data });
  } catch (err) { return serverError(res, err.message); }
}

export function patchCurrentVersion(req, res) {
  try {
    var { articleId } = req.params;
    var { version }   = req.body;
    var rec = getArticleById(articleId);
    if (!rec) return notFound(res, 'Article not found');
    var fp = path.join(STORAGE, articleId, 'versions', version + '.json');
    if (!fs.existsSync(fp)) return notFound(res, 'Version not found: ' + version);
    updateCurrentVersion(articleId, version);
    return ok(res, { articleId, currentVersion: version });
  } catch (err) { return serverError(res, err.message); }
}

export function patchMetadata(req, res) {
  try {
    var { articleId } = req.params;
    var rec = getArticleById(articleId);
    if (!rec) return notFound(res, 'Article not found');
    updateArticleMetadata(articleId, req.body);
    var updated = getArticleById(articleId);
    return ok(res, { articleId, meta: updated.meta });
  } catch (err) { return serverError(res, err.message); }
}
