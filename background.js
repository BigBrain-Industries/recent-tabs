
const tabIdToTimeout = new Map();

// set default to 3 seconds if not defined
browser.storage.local.get("timeBeforeTabConsideredViewedSetting").then((results) => {
    if (!results.timeBeforeTabConsideredViewedSetting) {
        let timeBeforeTabConsideredViewedSetting = {value: 3}; // default value is 3 seconds
        browser.storage.local.set({timeBeforeTabConsideredViewedSetting});
    }
});

// set default to 3 seconds if not defined
browser.storage.local.get("moveTabsToBeginningSetting").then((results) => {
    if (!results.moveTabsToBeginningSetting) {
        let moveTabsToBeginningSetting = {value: false}; // default value is false
        browser.storage.local.set({moveTabsToBeginningSetting});
    }
});

async function getMoveTabsToBeginning() {
    let results = await browser.storage.local.get("moveTabsToBeginningSetting");
    return results.moveTabsToBeginningSetting.value; //RDO: change to getter/setter
}

function onMoved(tab) {
    console.log(`Moved: ${tab}`);
}

function onMoveError(repeatAction) {
    return function (error) {
        console.log(`Error: ${error}`);
        // noinspection EqualityComparisonWithCoercionJS
        if (error == "Error: Tabs cannot be edited right now (user may be dragging a tab).") {
            console.log(`repeating Action in 200 millis`);
            setTimeout(repeatAction, 200);
        }
        else {
        }
    }
}

function toString(tab) {
    return `tab(${tab.id}) "${tab.title}" `
}

async function removeTimeout(tabId) {
    await cancelTabMove(tabId);
}

async function moveTabToDestination(tabId) {
    let tab = await browser.tabs.get(tabId);

    if (tab.pinned) {
        return;
    }
    let moving;
    let moveTabsToBeginning = await getMoveTabsToBeginning();
    if (moveTabsToBeginning) {
        moving = browser.tabs.move(tabId, {index: 0});
        console.log(`moving ${toString(tab)} to beginning`);
    } else {
        // Check if the tab is part of a group
        if (tab.groupId !== undefined && tab.groupId !== -1) {
            // Get all tabs in the current window
            let allTabs = await browser.tabs.query({windowId: tab.windowId});
            // Find all tabs in the same group
            let tabsInSameGroup = allTabs.filter(t => t.groupId === tab.groupId);

            let relevantTabs = (tabsInSameGroup.length > 0) ? tabsInSameGroup : allTabs;
            let lastTabIndex = Math.max(...relevantTabs.map(t => t.index));
            moving = browser.tabs.move(tabId, {index: lastTabIndex});
            console.log(`moving ${toString(tab)} to end at index: ${lastTabIndex}`);
        } else {
            // If not in a group, move to the end of all tabs
            moving = browser.tabs.move(tabId, {index: -1});
            console.log(`moving ${toString(tab)} to end`);
        }
    }
    moving.then(onMoved, onMoveError(async () => await moveTabToDestination(tabId)));
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

    //RDO: if timeBeforeTabConsideredViewed is over 30 seconds, must use the Alarms Api instead because of service worker lifecycle:  https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#convert-timers
    let results = await browser.storage.local.get("timeBeforeTabConsideredViewedSetting");
    let timeBeforeTabConsideredViewed = results.timeBeforeTabConsideredViewedSetting.value; //RDO: change to getter/setter
    let moveTimeoutId = setTimeout(async function () {
        await moveTabToDestination(tabId);
    }, timeBeforeTabConsideredViewed * 1000);
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
            await moveTabToDestination(parentTabId);
            await moveTabToDestination(tab.id);
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

browser.runtime.onMessage.addListener((message) => {
    if (message.command === "changeViewedTabTimeout") {
        let timeBeforeTabConsideredViewedSetting = { value: message.newValue };
        browser.storage.local.set({timeBeforeTabConsideredViewedSetting});
    }
    else if (message.command === "moveTabsToBeginning") {
        let moveTabsToBeginningSetting = { value: message.newValue };
        browser.storage.local.set({moveTabsToBeginningSetting});

    }
});
