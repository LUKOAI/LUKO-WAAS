/**
 * WAAS Content Pipeline — Automatic Mode
 * Tryb A: Operator wpisuje domenę + liczbę postów → AI robi resztę
 * 
 * 2 etapy:
 * 1. PLAN — AI analizuje research i planuje N artykułów
 * 2. WRITE — AI pisze każdy artykuł osobno (lepsza jakość)
 * 
 * @version 1.0
 */

var LUKO_SPREADSHEET_ID = '1oQnaP62owx0H2ZVpyXoLXWRGehhN81QrhNSb1Y-SV_4';

// ============================================================================
// MAIN: Auto Generate
// ============================================================================

function cpAutoGenerate() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Queue');
  if (!sheet) { ui.alert('Brak karty Content Pipeline'); return; }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i; });
  
  // Szukaj wierszy z ▶AutoGenerate_CP = TRUE
  var data = sheet.getDataRange().getValues();
  var jobs = [];
  
  for (var r = 1; r < data.length; r++) {
    if (data[r][col['\u25b6AutoGenerate_CP']] === true) {
      var domain = (data[r][col['Target_Domain_CP']] || '').toString().trim();
      var count = parseInt(data[r][col['Posts_Count_CP']]) || 3;
      var provider = (data[r][col['AI_Provider_CP']] || '').toString().trim() || 'Grok';
      
      if (!domain) continue;
      var aiNotes = (data[r][col['AI_Notes_CP']] || '').toString().trim();
      jobs.push({ row: r + 1, domain: domain, count: count, provider: provider, aiNotes: aiNotes });
    }
  }
  
  if (jobs.length === 0) {
    ui.alert('Brak wierszy z zaznaczonym ▶AutoGenerate_CP.\n\nWpisz domenę, liczbę postów i zaznacz checkbox.');
    return;
  }
  
  // Procesuj każdy job
  var totalCreated = 0;
  
  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j];
    
    try {
      // Status: working — clear validation first to allow any value
      if (col['Status_CP'] !== undefined) {
        var statusCell = sheet.getRange(job.row, col['Status_CP'] + 1);
        statusCell.clearDataValidations();
        statusCell.setValue('🔄 Generating...');
      }
      SpreadsheetApp.flush();
      
      var result = cpProcessAutoJob(sheet, col, job);
      totalCreated += result.created;
      
      // Mark as DONE
      sheet.getRange(job.row, col['\u25b6AutoGenerate_CP'] + 1).setValue('DONE');
      if (col['Status_CP'] !== undefined) {
        var doneCell=sheet.getRange(job.row, col['Status_CP'] + 1); doneCell.clearDataValidations(); doneCell.setValue('✅ ' + result.created + ' posts created');
      }
      
    } catch (e) {
      sheet.getRange(job.row, col['\u25b6AutoGenerate_CP'] + 1).setValue('ERROR');
      if (col['Status_CP'] !== undefined) {
        var errCell=sheet.getRange(job.row, col['Status_CP'] + 1); errCell.clearDataValidations(); errCell.setValue('❌ ' + e.message);
      }
      Logger.log('Auto error for ' + job.domain + ': ' + e.message);
    }
  }
  
  ui.alert('Auto Generate zakończone!\n\nStworzono: ' + totalCreated + ' artykuł(ów)\n\nPrzejrzyj wiersze i odpal ▶Export na wybranych.');
}

// ============================================================================
// PROCESS ONE JOB (domain + count)
// ============================================================================

function cpProcessAutoJob(sheet, col, job) {
  // 1. POBIERZ RESEARCH z LUKO
  var research = cpFetchResearch(job.domain);
  if (!research) {
    throw new Error('Nie znaleziono danych w LUKO dla: ' + job.domain);
  }
  
  // 2. ETAP 1: PLANOWANIE — AI tworzy plan artykułów
  var plan = cpStage1Plan(research, job.count, job.provider, job);
  if (!plan || !plan.plan || plan.plan.length === 0) {
    throw new Error('AI nie zwrócił planu artykułów');
  }
  
  // 3. ETAP 2: PISANIE — AI pisze każdy artykuł osobno
  var created = 0;
  
  for (var i = 0; i < plan.plan.length; i++) {
    var articlePlan = plan.plan[i];
    
    try {
      // Pisz artykuł
      var writeResult = cpStage2Write(research, articlePlan, job.provider, job);
      if (!writeResult) continue;
      var article = writeResult;
      
      if (created === 0) {
        // PIERWSZY artykuł: wypełnij TRIGGER ROW
        cpInsertAutoArticle(sheet, col, job.domain, articlePlan, article, job.provider, null, job.row);
      } else {
        // KOLEJNE: wstaw BEZPOŚREDNIO pod poprzednim
        var insertPos = job.row + created - 1;
        cpInsertAutoArticle(sheet, col, job.domain, articlePlan, article, job.provider, insertPos, null);
        // Oznacz nowy wiersz jako DONE (nie zostawiaj pustego checkboxa)
        var newRowNum = insertPos + 1;
        if (col['\u25b6AutoGenerate_CP'] !== undefined) {
          sheet.getRange(newRowNum, col['\u25b6AutoGenerate_CP'] + 1).setValue('DONE');
        }
      }
      created++;
      
      // Log produkcji
      cpLogProduction(job.domain, articlePlan, article, job.provider, result);
      
      // Rate limiting między artykułami
      if (i < plan.plan.length - 1) {
        Utilities.sleep(2000);
      }
    } catch (e) {
      Logger.log('Error writing article ' + (i+1) + ': ' + e.message);
    }
  }
  
  return { created: created };
}

// ============================================================================
// FETCH RESEARCH z LUKO
// ============================================================================

function cpFetchResearch(domain) {
  var slug = domain.replace('.lk24.shop', '').replace('https://', '');
  var fullDomain = slug + '.lk24.shop';
  
  try {
    var lukoSS = SpreadsheetApp.openById(LUKO_SPREADSHEET_ID);
  } catch(e) {
    throw new Error('Nie mogę otworzyć LUKO arkusza. Sprawdź dostęp.');
  }
  
  // Znajdź INPUT_Row dla tego slugu
  var inputRow = cpFindInputRow(lukoSS, slug);
  
  // SLUGS
  var slugsData = cpReadSlugs(lukoSS, slug, inputRow);
  
  // ANALYSIS
  var analysisData = cpReadAnalysis(lukoSS, inputRow);
  
  // ASINS
  var asinsData = cpReadAsins(lukoSS, slug, inputRow);
  
  if (!analysisData && !slugsData) return null;
  
  return {
    domain: fullDomain,
    slug: slug,
    slugs: slugsData,
    analysis: analysisData,
    asins: asinsData,
  };
}

function cpFindInputRow(lukoSS, slug) {
  var sheet = lukoSS.getSheetByName('SLUGS');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    var rowSlug = (data[r][2] || '').toString().trim(); // col C = slug
    if (rowSlug === slug) return data[r][0]; // col A = INPUT_Row
  }
  return null;
}

function cpReadSlugs(lukoSS, slug, inputRow) {
  var sheet = lukoSS.getSheetByName('SLUGS');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var ci = {}; h.forEach(function(v,i){ci[v]=i;});
  
  for (var r = 1; r < data.length; r++) {
    var rs = (data[r][ci['slug']] || '').toString().trim();
    if (rs === slug || data[r][0] == inputRow) {
      return {
        type: (data[r][ci['type']] || '').toString(),
        uzasadnienie: (data[r][ci['Uzasadnienie']] || '').toString(),
        amazonPhrase: (data[r][ci['Amazon Test Phrase']] || '').toString(),
        contentTopics: (data[r][ci['Content Topics']] || '').toString(),
        sitePatron: (data[r][ci['SitePatron']] || '').toString(),
        sellerName: (data[r][ci['SellerName']] || '').toString(),
        sellerID: (data[r][ci['SellerID']] || '').toString(),
      };
    }
  }
  return null;
}

function cpReadAnalysis(lukoSS, inputRow) {
  if (!inputRow) return null;
  var sheet = lukoSS.getSheetByName('ANALYSIS');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var ci = {}; h.forEach(function(v,i){ci[v]=i;});
  
  for (var r = 1; r < data.length; r++) {
    if (data[r][0] == inputRow) {
      var get = function(name) { return ci[name] !== undefined ? (data[r][ci[name]] || '').toString() : ''; };
      return {
        rynek: get('Rynek'),
        potrzebyProblemy: get('Potrzeby & Problemy'),
        buyerPersonas: get('Buyer Personas'),
        czesteSlowa: get('Czeste Slowa'),
        keywordKandydaci: get('Keyword Kandydaci'),
        sytuacjeUzycia: get('Sytuacje Uzycia'),
        triggery: get('Triggery Szukania'),
        pytania: get('Pytania'),
        tematyPoradnikowe: get('Tematy Poradnikowe'),
        czegoNieRobic: get('Czego Nie Robic'),
        topSklepy: get('Top Sklepy'),
        kontekstKulturowy: get('Kontekst Kulturowy'),
        sitePatron: get('SitePatron'),
        sellerName: get('SellerName'),
        sellerID: get('SellerID'),
      };
    }
  }
  return null;
}

function cpReadAsins(lukoSS, slug, inputRow) {
  var sheet = lukoSS.getSheetByName('ASINS');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var ci = {}; h.forEach(function(v,i){ci[v]=i;});
  
  var products = [];
  for (var r = 1; r < data.length; r++) {
    var rowSlug = (data[r][ci['Target_Slug']] || '').toString().trim();
    if (rowSlug === slug || data[r][0] == inputRow) {
      var asin = (data[r][ci['ASIN']] || '').toString().trim();
      if (!asin || asin.length < 10) continue;
      
      products.push({
        asin: asin,
        title: (data[r][ci['Title']] || '').toString(),
        price: data[r][ci['Price (EUR)']] || '',
        category: (data[r][ci['Category']] || '').toString(),
        bsr: data[r][ci['BSR_rank']] || '',
        brand: (data[r][ci['BrandName']] || '').toString(),
        bulletPoints: (data[r][ci['BulletPoints']] || '').toString(),
        features: (data[r][ci['Features']] || '').toString(),
        description: (data[r][ci['Description']] || '').toString(),
        material: (data[r][ci['Material']] || '').toString(),
        sitePatron: (data[r][ci['SitePatron']] || '').toString(),
        sellerName: (data[r][ci['SellerName']] || '').toString(),
      });
    }
  }
  return products.length > 0 ? products : null;
}

// ============================================================================
// BUILD RESEARCH CONTEXT — pakiet danych dla AI
// ============================================================================

function cpBuildResearchContext(research) {
  var parts = [];
  
  parts.push('=== WEBSITE & NISCHE ===');
  parts.push('Domain: ' + research.domain);
  parts.push('Slug/Keyword: ' + research.slug);
  if (research.slugs) {
    parts.push('Typ: ' + research.slugs.type);
    parts.push('Begründung: ' + research.slugs.uzasadnienie);
    parts.push('Amazon Suchbegriff: ' + research.slugs.amazonPhrase);
    if (research.slugs.contentTopics) parts.push('Content-Themen: ' + research.slugs.contentTopics);
  }
  
  // Patron info
  var hasPatron = false;
  var patronBrand = '';
  if (research.slugs && research.slugs.sitePatron) {
    hasPatron = true;
    patronBrand = research.slugs.sellerName || research.slugs.sellerID || '';
    parts.push('\n=== PATRON (Exklusiv-Partner) ===');
    parts.push('SitePatron aktiv: JA');
    parts.push('Patron/Hersteller: ' + patronBrand);
    parts.push('WICHTIG: NUR Produkte dieses Partners empfehlen!');
  }
  
  if (research.analysis) {
    var a = research.analysis;
    parts.push('\n=== MARKTANALYSE ===');
    if (a.rynek) parts.push('Markt: ' + a.rynek);
    if (a.kontekstKulturowy) parts.push('Kultureller Kontext: ' + a.kontekstKulturowy);
    if (a.potrzebyProblemy) parts.push('\nBedürfnisse & Probleme der Kunden:\n' + a.potrzebyProblemy);
    if (a.buyerPersonas) parts.push('\nBuyer Personas:\n' + a.buyerPersonas);
    if (a.pytania) parts.push('\nHäufige Fragen der Kunden:\n' + a.pytania);
    if (a.tematyPoradnikowe) parts.push('\nRatgeber-Themen:\n' + a.tematyPoradnikowe);
    if (a.sytuacjeUzycia) parts.push('\nAnwendungssituationen:\n' + a.sytuacjeUzycia);
    if (a.triggery) parts.push('\nSuch-Trigger:\n' + a.triggery);
    if (a.czegoNieRobic) parts.push('\nHäufige Fehler (Negativ-Themen):\n' + a.czegoNieRobic);
    if (a.keywordKandydaci) parts.push('\nKeyword-Kandidaten:\n' + a.keywordKandydaci);
    if (a.czesteSlowa) parts.push('\nHäufige Suchbegriffe:\n' + a.czesteSlowa);
  }
  
  if (research.asins && research.asins.length > 0) {
    parts.push('\n=== VERFÜGBARE PRODUKTE (' + research.asins.length + ') ===');
    
    // Filtruj: jeśli patron, tylko jego produkty
    var products = research.asins;
    if (hasPatron) {
      var patronProducts = products.filter(function(p) { 
        return p.sitePatron === 'TRUE' || p.sitePatron === true; 
      });
      if (patronProducts.length > 0) products = patronProducts;
    }
    
    products.forEach(function(p, i) {
      var line = (i+1) + '. ' + p.asin + ' — ' + p.title;
      if (p.price) line += ' (€' + p.price + ')';
      if (p.brand) line += ' [' + p.brand + ']';
      if (p.bsr) line += ' BSR:' + p.bsr;
      parts.push(line);
      
      // Dodaj bullet points jeśli są (cenne dla pisania!)
      if (p.bulletPoints && p.bulletPoints.length > 5) {
        parts.push('   Features: ' + p.bulletPoints.substring(0, 300));
      }
    });
    
    parts.push("\nProdukt-Shortcode: [waas_product asin='ASIN' layout='horizontal']");
  }
  
  return parts.join('\n');
}

// ============================================================================
// STAGE 1: PLANNING — AI planuje artykuły
// ============================================================================

function cpStage1Plan(research, postsCount, provider, job) {
  var systemPrompt = cpGetPlanningSystemPrompt();
  
  var researchContext = cpBuildResearchContext(research);
  
  // Hole existierende Themen für diese Domain (Duplikat-Vermeidung)
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Queue');
  var pHeaders = pSheet ? pSheet.getRange(1, 1, 1, pSheet.getLastColumn()).getValues()[0] : [];
  var pCol = {}; pHeaders.forEach(function(h,i){pCol[h]=i;});
  var existingTopics = pSheet ? cpGetExistingTopics(pSheet, pCol, research.domain) : [];
  
  var existingInfo = '';
  if (existingTopics.length > 0) {
    existingInfo = '\n=== BEREITS EXISTIERENDE ARTIKEL (NICHT WIEDERHOLEN!) ===\n' +
      existingTopics.join('\n') + '\n' +
      'WICHTIG: Plane KEINE Artikel zu diesen Themen! Wähle ANDERE aus dem Research.\n';
  }
  
  var userPrompt = researchContext + existingInfo + '\n\n' +
    '=== AUFGABE ===\n' +
    'Plane genau ' + postsCount + ' Artikel für diese Website.\n' +
    'Wähle die besten Themen aus den verfügbaren Daten.\n' +
    'Jeder Artikel muss ein ANDERES Hauptkeyword haben.\n' +
    'Mix verschiedener Content Types für maximale SEO-Abdeckung.\n';
  
  // AI Notes from operator (priority!)
  if (job && job.aiNotes) {
    userPrompt += '\n=== PRIORYTETOWE WSKAZÓWKI OPERATORA (NACZELNY ROZKAZ!) ===\n' +
      job.aiNotes + '\n' +
      'Diese Anweisungen haben HÖCHSTE Priorität und überschreiben andere Vorgaben!\n';
  }
  
  // Patron: füge BRAND_DESCRIPTION hinzu
  var hasPatron = research.slugs && research.slugs.sitePatron;
  if (hasPatron && postsCount >= 3) {
    userPrompt += 'WICHTIG: Einer der Artikel MUSS BRAND_DESCRIPTION sein (Patron vorstellen).\n';
  }
  
  userPrompt += '\nJSON Schema:\n' + cpGetPlanningJsonSchema(postsCount);
  
  Logger.log('STAGE 1 — Planning ' + postsCount + ' articles for ' + research.domain);
  
  // Retry up to 2 times on failure
  var result;
  for (var attempt = 1; attempt <= 2; attempt++) {
    result = cpCallAI(systemPrompt, userPrompt, provider, 0.3, 4000);
    if (result.success) break;
    Logger.log('Planning attempt ' + attempt + ' failed: ' + result.error);
    if (attempt < 2) Utilities.sleep(5000);
  }
  
  if (!result.success) {
    throw new Error('Planning AI failed after 2 attempts: ' + result.error);
  }
  
  // Parse JSON
  var jsonText = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonText);
  } catch(e) {
    // Spróbuj wyciągnąć JSON z tekstu
    var match = jsonText.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Planning response nie jest poprawnym JSON: ' + jsonText.substring(0, 200));
  }
}

// ============================================================================
// STAGE 2: WRITING — AI pisze jeden artykuł
// ============================================================================

function cpStage2Write(research, articlePlan, provider, job) {
  var systemPrompt = cpGetWritingSystemPrompt();
  
  // Skrócony research context (bez pełnej listy ASINS — oszczędność tokenów)
  var researchContext = cpBuildResearchContext(research);
  
  var userPrompt = researchContext + '\n\n' +
    '=== AUFGABE: SCHREIBE DIESEN ARTIKEL ===\n' +
    'Content Type: ' + articlePlan.content_type + '\n' +
    'Headline Type: ' + articlePlan.headline_type + '\n' +
    'Arbeitstitel: ' + articlePlan.working_title + '\n' +
    'Hauptkeyword: ' + articlePlan.primary_keyword + '\n' +
    'Sekundäre Keywords: ' + (articlePlan.secondary_keywords || '') + '\n' +
    'Zielgruppe: ' + (articlePlan.target_audience || '') + '\n' +
    'Problem/Bedürfnis: ' + (articlePlan.problem_need || '') + '\n' +
    'Blickwinkel: ' + (articlePlan.angle || '') + '\n' +
    'Produkt-ASINs: ' + (articlePlan.product_asins || '') + '\n\n' +
    'JSON Schema:\n' + cpGetWritingJsonSchema();
  
  // AI Notes from operator (highest priority!)
  if (job && job.aiNotes) {
    userPrompt += '\n\n=== PRIORYTETOWE WSKAZÓWKI OPERATORA ===\n' +
      job.aiNotes + '\nDiese Anweisungen überschreiben andere Vorgaben!';
  }
  
  Logger.log('STAGE 2 — Writing: ' + articlePlan.working_title);
  
  var result;
  for (var attempt = 1; attempt <= 2; attempt++) {
    result = cpCallAI(systemPrompt, userPrompt, provider, 0.7, 12000);
    if (result.success) break;
    Logger.log('Writing attempt ' + attempt + ' failed: ' + result.error);
    if (attempt < 2) Utilities.sleep(5000);
  }
  
  if (!result.success) {
    Logger.log('Writing AI failed: ' + result.error);
    return null;
  }
  
  // Parse JSON
  var jsonText = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonText);
  } catch(e) {
    var match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch(e2) {}
    }
    Logger.log('Write response parse failed: ' + jsonText.substring(0, 300));
    return null;
  }
}

// ============================================================================
// INSERT — wstaw gotowy artykuł do Content Pipeline
// ============================================================================

function cpInsertAutoArticle(sheet, col, domain, plan, articleJson, provider, insertAfterRow, fillRow) {
  var newRow;
  
  if (fillRow) {
    // Wypełnij istniejący wiersz (trigger row — pierwszy artykuł)
    newRow = fillRow;
  } else if (insertAfterRow) {
    // Wstaw nowy wiersz POD wskazanym
    sheet.insertRowAfter(insertAfterRow);
    newRow = insertAfterRow + 1;
  } else {
    newRow = sheet.getLastRow() + 1;
  }
  
  var set = function(colName, value) {
    if (col[colName] !== undefined && value !== undefined && value !== null) {
      var cell = sheet.getRange(newRow, col[colName] + 1);
      // Clear dropdown validation for status/checkbox cells to allow any value
      if (colName === 'Status_CP' || colName.indexOf('\u25b6') >= 0) {
        cell.clearDataValidations();
      }
      cell.setValue(value);
    }
  };
  
  // Extract slug for site code
  var slug = domain.replace('.lk24.shop', '');
  var siteCode = slug.substring(0, 2).toUpperCase();
  // Better site code from CP_CONFIG if available
  if (typeof CP_CONFIG !== 'undefined' && CP_CONFIG.SITE_CODES && CP_CONFIG.SITE_CODES[domain]) {
    siteCode = CP_CONFIG.SITE_CODES[domain];
  }
  
  var cpId = 'CP-' + siteCode + '-' + String(Math.floor(Math.random() * 900) + 100);
  
  var article = articleJson.article || {};
  var seo = articleJson.seo || {};
  var ctas = articleJson.ctas || {};
  var faq = articleJson.faq || [];
  
  // Identyfikacja
  set('ID_CP', cpId);
  set('Target_Domain_CP', domain);
  set('Mode_CP', 'A');
  set('AI_Provider_CP', provider);
  
  // Konfiguracja (z planu)
  set('Content_Type_CP', plan.content_type);
  set('Headline_Type_CP', plan.headline_type);
  set('Headline_Strategy_CP', 'AUTO');
  set('Text_Length_CP', 'AUTO');
  set('Products_Count_CP', 'AUTO');
  
  // Input (z planu)
  set('Working_Title_CP', plan.working_title);
  set('Primary_Keyword_CP', plan.primary_keyword);
  set('Secondary_Keywords_CP', plan.secondary_keywords);
  set('Problem_Need_CP', plan.problem_need);
  set('Target_Audience_CP', plan.target_audience);
  set('Product_ASINs_CP', plan.product_asins);
  set('Notes_CP', 'Auto [' + provider + '] ' + (plan.reasoning || ''));
  
  // Gotowy artykuł
  set('Final_Title_CP', article.title);
  set('Final_Slug_CP', article.slug);
  set('Excerpt_CP', article.excerpt);
  set('Sections_JSON_CP', article.sections ? JSON.stringify(article.sections) : '');
  set('Word_Count_CP', article.word_count);
  
  // SEO
  set('Meta_Description_CP', seo.meta_description);
  set('SEO_Title_CP', seo.seo_title);
  set('Focus_Keyword_CP', seo.focus_keyword);
  set('Tags_CP', Array.isArray(seo.tags) ? seo.tags.join(', ') : (seo.tags || ''));
  
  // FAQ & CTAs
  if (faq && faq.length > 0) {
    set('FAQ_JSON_CP', JSON.stringify(faq));
    set('Include_FAQ_CP', true);
  }
  if (ctas) set('CTAs_JSON_CP', JSON.stringify(ctas));
  
  // Status — GOTOWY DO EXPORTU
  set('Status_CP', '✅ Complete');
  
  // Quality score
  var score = cpAutoQualityScore(article, seo, plan);
  set('Quality_Score_CP', score);
  
  // Checkboxy text/parse na DONE (bo AI zrobił)
  set('\u25b6Text_CP', 'AUTO');
  set('\u25b6ParseText_CP', 'AUTO');
}

// ============================================================================
// AUTO QUALITY SCORE (uproszczony)
// ============================================================================

function cpAutoQualityScore(article, seo, plan) {
  var score = 0;
  
  if (article.title && article.title.length > 10) score += 15;
  if (seo.meta_description && seo.meta_description.length >= 100) score += 10;
  if (article.sections && article.sections.length >= 3) score += 15;
  if (article.word_count && article.word_count >= 800) score += 10;
  if (article.products_shortcodes && article.products_shortcodes.length > 0) score += 15;
  if (seo.focus_keyword) score += 10;
  if (article.slug && article.slug.length > 3) score += 10;
  if (article.sections && article.sections.some(function(s) { return s.type === 'fazit'; })) score += 10;
  if (plan.primary_keyword && article.title && 
      article.title.toLowerCase().indexOf(plan.primary_keyword.toLowerCase()) >= 0) score += 5;
  
  return score;
}


// ============================================================================
// DUPLICATE CHECK — sprawdź co już było napisane dla tej domeny
// ============================================================================

function cpGetExistingTopics(sheet, col, domain) {
  var data = sheet.getDataRange().getValues();
  var topics = [];
  
  for (var r = 1; r < data.length; r++) {
    var rowDomain = (data[r][col['Target_Domain_CP']] || '').toString().trim();
    if (rowDomain !== domain) continue;
    
    var title = (data[r][col['Working_Title_CP']] || '').toString().trim();
    var finalTitle = (data[r][col['Final_Title_CP']] || '').toString().trim();
    var keyword = (data[r][col['Primary_Keyword_CP']] || '').toString().trim();
    
    if (title) topics.push(title);
    if (finalTitle && finalTitle !== title) topics.push(finalTitle);
    if (keyword) topics.push(keyword);
  }
  
  return topics;
}

// ============================================================================
// PRODUCTION LOG — protokół produkcji
// ============================================================================

function cpLogProduction(domain, plan, articleJson, provider, aiResult) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName('CP Production Log');
    
    if (!logSheet) {
      logSheet = ss.insertSheet('CP Production Log');
      logSheet.getRange(1, 1, 1, 10).setValues([[
        'Timestamp', 'Domain', 'ID_CP', 'Content_Type', 'Title', 
        'AI_Provider', 'Word_Count', 'Tokens_Used', 'Language', 'Status'
      ]]);
      logSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#37474F').setFontColor('#FFFFFF');
      logSheet.setFrozenRows(1);
      logSheet.setTabColor('#795548');
    }
    
    var article = articleJson ? (articleJson.article || {}) : {};
    var tokens = (aiResult && aiResult.usage) ? 
      (aiResult.usage.total_tokens || aiResult.usage.input_tokens + aiResult.usage.output_tokens || 0) : 0;
    
    var row = [
      new Date(),
      domain,
      plan.nr || '',
      plan.content_type || '',
      article.title || plan.working_title || '',
      provider,
      article.word_count || 0,
      tokens,
      'DE',
      'Created'
    ];
    
    logSheet.appendRow(row);
  } catch(e) {
    Logger.log('Log error: ' + e.message);
  }
}

// ============================================================================
// SETUP — dodaj nowe kolumny Auto do Content Pipeline
// ============================================================================

function cpSetupAutoColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Pipeline') || ss.getSheetByName('Content Queue');
  if (!sheet) { SpreadsheetApp.getUi().alert('Brak karty Content Pipeline'); return; }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Sprawdź czy kolumny już istnieją
  if (headers.indexOf('Mode_CP') >= 0) {
    SpreadsheetApp.getUi().alert('Kolumny Auto już istnieją.');
    return;
  }
  
  // Znajdź ID_CP i wstaw ZARAZ PO Target_Domain_CP
  var tdCol = headers.indexOf('Target_Domain_CP');
  if (tdCol < 0) tdCol = headers.indexOf('ID_CP');
  if (tdCol < 0) { SpreadsheetApp.getUi().alert('Brak kolumn Pipeline.'); return; }
  
  // Nowe kolumny: Mode, Posts_Count, AI_Provider, ▶AutoGenerate
  var insertAfter = tdCol + 1;
  var newCols = [
    { name: 'Mode_CP', width: 45 },
    { name: 'Posts_Count_CP', width: 45 },
    { name: 'AI_Provider_CP', width: 75 },
    { name: 'AI_Notes_CP', width: 200 },
    { name: '\u25b6AutoGenerate_CP', width: 50 },
  ];
  
  // Wstaw 4 kolumny
  for (var i = 0; i < newCols.length; i++) {
    sheet.insertColumnAfter(insertAfter + i);
  }
  
  // Odśwież headers
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Ustaw nagłówki
  for (var i = 0; i < newCols.length; i++) {
    var colIdx = insertAfter + i + 1;
    sheet.getRange(1, colIdx).setValue(newCols[i].name);
    sheet.setColumnWidth(colIdx, newCols[i].width);
  }
  
  // Odśwież headers po nazewnictwie
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Dropdowny
  var modeCol = headers.indexOf('Mode_CP');
  var countCol = headers.indexOf('Posts_Count_CP');
  var aiCol = headers.indexOf('AI_Provider_CP');
  var autoCol = headers.indexOf('\u25b6AutoGenerate_CP');
  
  if (modeCol >= 0) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['A', 'M'], true).build();
    sheet.getRange(2, modeCol + 1, 200, 1).setDataValidation(rule);
  }
  if (countCol >= 0) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['1','2','3','4','5','6','7','8','9','10'], true).build();
    sheet.getRange(2, countCol + 1, 200, 1).setDataValidation(rule);
  }
  if (aiCol >= 0) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Grok','OpenAI','Claude'], true).build();
    sheet.getRange(2, aiCol + 1, 200, 1).setDataValidation(rule);
  }
  if (autoCol >= 0) {
    sheet.getRange(2, autoCol + 1, 200, 1).insertCheckboxes();
  }
  
  // Koloruj
  var autoCols = [modeCol, countCol, aiCol, autoCol];
  autoCols.forEach(function(c) {
    if (c >= 0) {
      sheet.getRange(1, c + 1).setBackground('#FF6F00').setFontColor('#FFFFFF').setFontWeight('bold');
      sheet.getRange(2, c + 1, 50, 1).setBackground('#FFF3E0');
    }
  });
  
  SpreadsheetApp.getUi().alert(
    'Kolumny Auto dodane!\n\n' +
    'Mode_CP — A (auto) / M (manual)\n' +
    'Posts_Count_CP — 1-10 postów\n' +
    'AI_Provider_CP — Grok / OpenAI / Claude\n' +
    '▶AutoGenerate_CP — zaznacz i odpal z menu\n\n' +
    'Ustaw też API keys: Content Pipeline → Setup AI Keys'
  );
}