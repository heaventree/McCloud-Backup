'use strict';

(function () {

  const body = document.body;


  //-------------------------------------------------------------------------------------------------------------
  // Initializing scrollspy
  var scrollSpy = new bootstrap.ScrollSpy(document.body, {
    target: '#sidebarNav'
  });



  //-------------------------------------------------------------------------------------------------------------
  // Codemirror
  document.querySelectorAll(".code-non-editable").forEach(function (editorEl) {
    CodeMirror.fromTextArea(editorEl, {
      mode: "javascript",
      theme: "xq-light",
      lineNumbers: false,
      readOnly: true,
      maxHighlightLength: 0,
      workDelay: 0
    });
  });
  
  
  
  // Enable feather-icons with SVG markup
  //-------------------------------------------------------------------------------------------------------------
  feather.replace();
  
})();    