"use strict";

function hashchange (e) {
	if (isHistorySuppressed) {
		setSuppressHistory(false);
		return;
	}

	const [link, ...sub] = _getHashParts();

	let blankFilterLoad = false;
	if (!e || sub.length === 0) {
		if (link === HASH_BLANK) {
			blankFilterLoad = true;
		} else {
			const $el = _getListElem(link);
			if ($el === undefined) {
				if (typeof handleUnknownHash === "function" && window.location.hash.length) {
					handleUnknownHash(link, sub);
					return;
				} else {
					_freshLoad();
					return;
				}
			}
			const toLoad = $el.attr("id");
			if (toLoad === undefined) _freshLoad();
			else {
				loadhash($el.attr("id"));
				document.title = decodeURIComponent($el.attr("title")) + " - 5etools";
			}
		}
	}

	if (typeof loadsub === "function" && sub.length > 0) loadsub(sub);
	if (blankFilterLoad) {
		window.location.hash = "";
	}
}

function initHistory () {
	window.onhashchange = hashchange;
	if (window.location.hash.length) {
		hashchange();
	} else {
		_freshLoad();
	}
}

let isHistorySuppressed = false;
/**
 * Allows the hash to be modified without triggering a hashchange
 * @param val
 */
function setSuppressHistory (val) {
	isHistorySuppressed = val;
}

function getSelectedListElement () {
	const [link, ...sub] = _getHashParts();
	return _getListElem(link);
}

function _getHashParts () {
	return window.location.hash.slice(1).split(HASH_PART_SEP);
}

function _getListElem (link) {
	const toFind = `a[href="#${link.toLowerCase()}"]`;
	const listWrapper = $("#listcontainer");
	if (listWrapper.data("lists")) {
		for (const list of listWrapper.data("lists")) {
			for (const item of list.items) {
				const $elm = $(item.elm).find(toFind);
				if ($elm[0]) {
					return $elm
				}
			}
		}
	}
	return undefined;
}

function _freshLoad () {
	location.replace($("#listcontainer").find(".list a").attr('href'));
}