let searchIndex;

window.addEventListener("load", init);

function init () {
	const $nav = $(`#navbar`);
	$nav.append(`
		<div class="input-group" style="padding: 3px 0;">
			<input id="omnisearch-input" class="form-control" placeholder="Search everywhere..." title="Disclaimer: unlikely to search everywhere. Use with caution.">
			<div class="input-group-btn">
				<button class="btn btn-default" id="omnisearch-submit" ><span class="glyphicon glyphicon-search"></span></button>
			</div>
		</div>
	`);
	$nav.after(`<div class="omnisearch-output-wrapper"><div id="omnisearch-output" class="omnisearch-output"></div></div>`);

	DataUtil.loadJSON("search/index.json", onSearchLoad);

	const $searchOutWrapper = $(`.omnisearch-output-wrapper`);
	const $searchOut = $(`#omnisearch-output`);
	const $searchIn = $(`#omnisearch-input`);
	const $searchSubmit = $(`#omnisearch-submit`);

	let clickFirst = false;

	$(`body`).on("click", () => {
		$searchOutWrapper.hide();
	});

	$searchOut.on("click", (e) => {
		e.stopPropagation();
	});

	$searchIn.on("keypress", (e) => {
		if (e.which === 13) {
			clickFirst = true;
			$searchSubmit.click();
		}
		e.stopPropagation();
	});

	// auto-search after 100ms
	const TYPE_TIMEOUT_MS = 100;
	let typeTimer;
	$searchIn.on("keyup", () => {
		clearTimeout(typeTimer);
		typeTimer = setTimeout(() => {
			$searchSubmit.click()
		}, TYPE_TIMEOUT_MS);
	});
	$searchIn.on("keydown", () => {
		clearTimeout(typeTimer);
	});
	$searchIn.on("click", (e) => {
		if ($searchIn.val() && $searchIn.val().trim().length) $searchSubmit.click();
		e.stopPropagation();
	});

	$searchSubmit.on("click", (e) => {
		e.stopPropagation();
		doSearch();
	});

	const MAX_RESULTS = 15;
	function doSearch () {
		const srch = $searchIn.val();

		const tokens = elasticlunr.tokenizer(srch);
		const tokensIsCat = tokens.map(t => {
			const category = Object.keys(CATEGORY_COUNTS).map(k => k.toLowerCase()).find(k => (k === t.toLowerCase().trim() || `${k}s` === t.toLowerCase().trim()));
			return {
				t: t,
				isCat: !!category,
				c: category
			};
		});

		let page = 0;

		const catTokens = tokensIsCat.filter(tc => tc.isCat);
		let results;
		if (catTokens.length === 1) {
			const noCatTokens = tokensIsCat.filter(tc => !tc.isCat).map(tc => tc.t);
			results = searchIndex.search(noCatTokens.join(" "), {
				fields: {
					s: {boost: 5, expand: true},
					src: {expand: true}
				},
				bool: "AND",
				expand: true
			}).filter(r => r.doc.c === catTokens[0].c);
		} else {
			results = searchIndex.search(srch, {
				fields: {
					s: {boost: 5, expand: true},
					src: {expand: true}
				},
				bool: "AND",
				expand: true
			});
		}

		if (!doShow3pp()) {
			results = results.filter(r => !_isNonStandardSource3pp(r.doc.src));
		}
		if (!doShowUaEtc()) {
			results = results.filter(r => !_isNonStandardSourceWiz(r.doc.src));
		}

		if (results.length) {
			renderLinks();
		} else {
			$searchOut.empty();
			$searchOutWrapper.hide();
		}

		function renderLinks () {
			$searchOut.empty();
			const show3pp = doShow3pp();
			const $btn3pp = $(`<button class="btn btn-default btn-xs btn-file">${show3pp ? "Exclude" : "Include"} 3pp</button>`)
				.on("click", () => {
					setShow3pp(!show3pp);
					doSearch();
				});
			const showUa = doShowUaEtc();
			const $btnUaEtc = $(`<button class="btn btn-default btn-xs btn-file">${showUa ? "Exclude" : "Include"} UA, etc</button>`)
				.on("click", () => {
					setShowUaEtc(!showUa);
					doSearch();
				});

			$searchOut.append($(`<div class="text-align-right"/>`).append($btnUaEtc).append(" ").append($btn3pp));
			const base = page * MAX_RESULTS;
			for (let i = base; i < Math.max(Math.min(results.length, MAX_RESULTS + base), base); ++i) {
				const r = results[i].doc;
				$searchOut.append(`
				<p>
					<a href="${r.url}" ${r.hov || ""}>${r.c}: ${r.s}</a>
					<i title="${Parser.sourceJsonToFull(r.src)}">${Parser.sourceJsonToAbv(r.src)}${r.pg ? ` p${r.pg}` : ""}</i>
				</p>`);
			}
			$searchOutWrapper.css("display", "flex");

			// add pagination if there are many results
			if (results.length > MAX_RESULTS) {
				const $pgControls = $(`<div class="omnisearch-pagination-wrapper">`);
				if (page > 0) {
					const $prv = $(`<span class="pg-left pg-control"><span class="glyphicon glyphicon-chevron-left"></span></span>`).on("click", () => {
						page--;
						renderLinks();
					});
					$pgControls.append($prv);
				} else ($pgControls.append(`<span class="pg-left">`));
				$pgControls.append(`<span class="pg-count">Page ${page + 1}/${Math.ceil(results.length / MAX_RESULTS)} (${results.length} results)</span>`);
				if (results.length - (page * MAX_RESULTS) > MAX_RESULTS) {
					const $nxt = $(`<span class="pg-right pg-control"><span class="glyphicon glyphicon-chevron-right"></span></span>`).on("click", () => {
						page++;
						renderLinks();
					});
					$pgControls.append($nxt)
				} else ($pgControls.append(`<span class="pg-right pg-control">`));
				$searchOut.append($pgControls);
			}

			if (clickFirst) {
				$searchOut.find(`a`).first()[0].click();
			}
		}
	}

	const COOKIE_NAME_3PP = "search-3pp";
	const COOKIE_NAME_UA_ETC = "search-ua-etc";
	const CK_SHOW = "SHOW";
	const CK_HIDE = "HIDE";

	let show3pp;
	function doShow3pp () {
		if (!show3pp) show3pp = Cookies.get(COOKIE_NAME_3PP);
		return show3pp !== CK_HIDE;
	}

	function setShow3pp (value) {
		show3pp = value ? CK_SHOW : CK_HIDE;
		Cookies.set(COOKIE_NAME_3PP, show3pp, {expires: 365});
	}

	let showUaEtc;
	function doShowUaEtc () {
		if (!showUaEtc) showUaEtc = Cookies.get(COOKIE_NAME_UA_ETC);
		return showUaEtc !== CK_HIDE;
	}

	function setShowUaEtc (value) {
		showUaEtc = value ? CK_SHOW : CK_HIDE;
		Cookies.set(COOKIE_NAME_UA_ETC, showUaEtc, {expires: 365});
	}
}

const CATEGORY_COUNTS = {};
function onSearchLoad (data) {
	searchIndex = elasticlunr(function () {
		this.addField("s");
		this.addField("c");
		this.addField("src");
		this.setRef("id")
	});
	data.forEach(d => {
		d.c = Parser.pageCategoryToFull(d.c);
		if (!CATEGORY_COUNTS[d.c]) CATEGORY_COUNTS[d.c] = 1;
		else CATEGORY_COUNTS[d.c]++;
		searchIndex.addDoc(d);
	});
}