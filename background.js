function onMoved(tab) {
    console.log(`Moved: ${tab}`);
}

function onError(error) {
    console.log(`Error: ${error}`);
}

const tabToTimeout = new Map();

async function onActivatedListener(activeInfo) {
    let tabId = activeInfo.tabId;
    let tab = await browser.tabs.get(tabId);

    // cancel any pending moves and start a new move
    if (tabToTimeout.has(tabId)) {
        let timeout = tabToTimeout.get(tabId);
        clearTimeout(timeout);
        console.log(`deleting existing timeout ${timeout} for tab ${tabId}`);
        tabToTimeout.delete(tabId);
    }

    let moveTimeoutId = setTimeout(async function () {
        let tab = await browser.tabs.get(tabId);
        console.log(`tab ${tabId} active state: ${tab.active}`);
        if (tab.active) {
            let moving = browser.tabs.move(tabId, {index: -1});
            moving.then(onMoved, onError);
        }
    }, 3000);
    console.log(`setting timeout ${moveTimeoutId} for tab ${tabId}`);
    tabToTimeout.set(tabId, moveTimeoutId);
}

browser.tabs.onActivated.addListener(
    onActivatedListener
);