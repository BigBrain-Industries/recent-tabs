function onMoved(tab) {
    console.log(`Moved: ${tab}`);
}

function onError(error) {
    console.log(`Error: ${error}`);
}

const tabIdToTimeout = new Map();
const timeBeforeTabConsideredViewed = 3000;

function toString(tab) {
    return `tab(${tab.id}) "${tab.title}" `
}

async function removeTimeout(tabId) {
    await cancelTabMove(tabId);
}

async function moveTabToEnd(tabId) {
    let tab = await browser.tabs.get(tabId);

    // if (tab.active) {
    let moving = browser.tabs.move(tabId, {index: -1});
    console.log(`moving ${toString(tab)} to end`);
    moving.then(onMoved, onError);
    // }
}

async function onTabActivated(activeInfo) {
    let tabId = activeInfo.tabId;
    let tab = await browser.tabs.get(tabId);

    // cancel all other tabs timeouts
    for (let [existingTabId] of tabIdToTimeout) {
        if (tabId !== existingTabId) {
            try {
                let existingTab = await browser.tabs.get(existingTabId);
                console.log(`tab ${toString(tab)} was activated. Removing existing timeout for tab ${toString(existingTab)}`)
                await removeTimeout(existingTabId);
            } catch (e) {
                console.warn(`failed to remove tmieout for existing tab ${existingTabId}`);
            }
        }
    }

    if (tabIdToTimeout.has(tabId)) {
        console.log(`tab ${toString(tab)} already has a move timeout. Cancelling that timeout.`);
        await cancelTabMove(tabId);
    }

    let moveTimeoutId = setTimeout(async function () {
        await moveTabToEnd(tabId);
    }, timeBeforeTabConsideredViewed);
    console.log(`setting timeout ${moveTimeoutId} for tab ${toString(tab)}`);
    tabIdToTimeout.set(tabId, moveTimeoutId);
}

async function cancelTabMove(tabId) {

    // cancel any pending moves
    if (tabIdToTimeout.has(tabId)) {
        let timeout = tabIdToTimeout.get(tabId);
        clearTimeout(timeout);
        try {
            let tab = await browser.tabs.get(tabId);
            console.log(`deleted existing timeout ${timeout} for tab ${tab}`);
        } catch (e) {
            // tab might not exist anymore
        }
        tabIdToTimeout.delete(tabId);
    }
}

async function onTabCreated(tab) {

    // the created tab and parent tab should immediately move all the way to the right.
    if (tab.openerTabId) {
        let parentTab = await browser.tabs.get(tab.openerTabId);
        console.log(`parent tab is ${parentTab.title}`);
        const parentTabId = parentTab.id;
        if (tabIdToTimeout.has(parentTabId)) {
            await cancelTabMove(parentTabId);
            await moveTabToEnd(parentTabId);
            await moveTabToEnd(tab.id);
        }
    }

}

async function onTabRemoved(tabId) {
    await cancelTabMove(tabId);
}

async function onTabMoved(tabId) {
    // fires both when moved by user and when moved by this plugin
    // await cancelTabMove(tabId);
}

async function onTabDetached(tabId) {
    await cancelTabMove(tabId);
}

browser.tabs.onActivated.addListener(
    async (activeInfo) => {
        try {
            await onTabActivated(activeInfo);
        } catch (e) {
            console.error(e);
        }
    }
);

browser.tabs.onRemoved.addListener(
    async (tabId) => {
        try {
            console.info(`removing tab ${tabId}`);
            await onTabRemoved(tabId);
        } catch (e) {
            console.error(e);
        }
    }
);

browser.tabs.onMoved.addListener(
    async (tabId) => {
        try {
            await onTabMoved(tabId);
        } catch (e) {
            console.error(e);
        }
    }
);

browser.tabs.onDetached.addListener(
    async (tabId) => {
        try {
            await onTabDetached(tabId);
        } catch (e) {
            console.error(e);
        }
    }
);

browser.tabs.onCreated.addListener(
    async (tab) => {
        try {
            await onTabCreated(tab);
        } catch (e) {
            console.error(e);
        }
    }
);

browser.runtime.onSuspend.addListener(() => {
    console.log("Unloading.");
});