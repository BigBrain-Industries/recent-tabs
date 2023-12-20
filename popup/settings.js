
// set initial value
let timeBeforeTabConsideredViewedSettingSlider = document.getElementById("myRange");
browser.storage.local.get("timeBeforeTabConsideredViewedSetting").then(
    (results) => {
        let storedValue = results.timeBeforeTabConsideredViewedSetting.value;
        timeBeforeTabConsideredViewedSettingSlider.value = storedValue;
        let currentValueSpan = document.getElementById("demo");
        currentValueSpan.innerHTML = storedValue;
});

timeBeforeTabConsideredViewedSettingSlider.addEventListener("input", e => {
    let newValue = e.target.value;
    let currentValueSpan = document.getElementById("demo");
    currentValueSpan.innerHTML = newValue;
    browser.runtime.sendMessage({
        command: "changeViewedTabTimeout",
        newValue: newValue
    });
})

// set initial value
let moveTabsToLeftCheckbox = document.getElementById("moveTabsToLeftCheckbox");
browser.storage.local.get("moveTabsToBeginningSetting").then(
    (results) => {
        let storedValue = results.moveTabsToBeginningSetting.value;
        if (storedValue) {
            moveTabsToLeftCheckbox.checked = true;
        }
});

moveTabsToLeftCheckbox.addEventListener("input", e => {
    let newValue = (e.target.checked);
    browser.runtime.sendMessage({
        command: "moveTabsToBeginning",
        newValue: newValue
    });
})
