(function () {
  var url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('icons/streaktab_icon.svg')
    : 'icons/streaktab_icon.svg';
  var link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = url;
  document.head.appendChild(link);
})();
