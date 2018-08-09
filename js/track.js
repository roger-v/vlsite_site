var PAGE_LIMIT = 20;
var API_PATH_TOKEN = "http://site.vintage-logistics.com:81/IMEXWEBREPSAPI/token";
var API_PATH_FL = "http://site.vintage-logistics.com:81/IMEXWEBREPSAPI/api/FMS/GetDashboard";
var isLoading = false;
var shipments_array;
var shipments_array_size;
var lastPage = 1;

//Encodes client request username and password from JSON to x-www-form-urlencoded
function JSON_to_URLEncoded(element,key,list){
  var list = list || [];
  if(typeof(element)=='object'){
    for (var idx in element)
      JSON_to_URLEncoded(element[idx],key?key+'['+idx+']':idx,list);
  } else {
    list.push(key+'='+encodeURIComponent(element));
  }
  return list.join('&');
}

function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(let i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {   
    document.cookie = name+'=; Max-Age=-99999999;';  
}

function cookieExists(name){
    return getCookie(name) != null && getCookie(name) != "";
}

// Sends the request to the IMEXWEB API for login, and sets access_token cookie
// so that the browser remembers to stay logged in on this site.
function getAccessToken(email, password) {
  startLoadingAnimation();
  var dat = {
          "grant_type":"password",
          "username": email,
          "password": password
        };
  $.ajax({
        url: API_PATH_TOKEN,
        dataType: 'json',
        type: 'post',
        contentType: 'application/x-www-form-urlencoded',
        data: JSON_to_URLEncoded(dat),
        success: function(data) {
          access_token = data.access_token;
          setCookie("access_token", access_token, 7);
          simulateLogin();
          //stopLoadingAnimation();
        },
        error: function(jqxhr, status, error) {
          simulateLogout();
          if (status == "timeout") {
            showLoginError("The server timed out.");
          } else if (status == "error"){
            showLoginError("Your username or password are incorrect.");
          } else showLoginError("There was an error logging in.");
          
          stopLoadingAnimation();
        }
      }
      );
}

//Sends the request to IMEXWEB API to retrieve freight load data, using access_token cookie.
//page=1 shows the first PAGE_LIMIT elements, page=2 shows the second PAGE_LIMIT elements, etc...
function getFreightLoads(page) {
  startLoadingAnimation();
  if (getCookie("access_token") == null) return;
  $.ajax({
      url: (API_PATH_FL + "?fromDate=2000-01-01&toDate=" + dateTodayStr()),
      dataType: 'json',
      type: 'get',
      contentType: 'application/x-www-form-urlencoded',
      beforeSend: function (xhr) {
          xhr.setRequestHeader ("Authorization", "bearer " + getCookie("access_token"));
      },
      processData: false,
      success: function(data) {
        shipments_array = data.Results;
        shipments_array_size = data.Count;
        (data.Results[0] != null) ? setCookie("username", data.Results[0].Customer, 7) : "";
        var customer = !cookieExists("username") ? "My " : getCookie("username") + "'s "
        $("#heading").html(customer + " Shipments (total: " + data.Count + ")");
        setPage(page);
        stopLoadingAnimation();
      },
      error: function(jqxhr) {
        simulateLogout();
        stopLoadingAnimation();
        showLoginError("There was an error getting your shipment data.");
      }
    }
    );
}

//Manipulates the HTML to display a table containing the freight loads.
function displayFreightLoads(freightLoads, page, totalLoads){
  var offset = (page - 1)*PAGE_LIMIT;
  var rval = "";
  for (let i = offset; i < freightLoads.length && i < offset + PAGE_LIMIT; i++)
    rval += getRowHTML(freightLoads[i], i);
  $("tbody").html(rval);
  var totalPages = Math.ceil(totalLoads/PAGE_LIMIT);
  if (totalLoads > PAGE_LIMIT) generatePaginationNav(page, totalPages);
  else generatePaginationNav(1, 1);
}

//Returns the content for one <tr> tag for one freight load.
function getRowHTML(row, index){
  var arr = getRowFieldsAsArray(row);
  var rval = "<tr><th scope=\"row\">" + (index + 1).toString() + "</th>";
  for (let i = 0; i < arr.length; i++){
    rval += ("<td>" + ((arr[i] == null) ? "" : arr[i]) + "</td>");
  }
  return rval;
}

//Crops the date to show YYYY-MM-DD
function formatDate(dateString){
  if (dateString == null) return "";
  return dateString.substring(0, 10);
}

//Manipulates the HTML view and displays the freight loads.
function simulateLogin() {
  $("#form_div").hide();
  $("#table").show();
  $("#msg").hide();  
  getFreightLoads(1);
  setStatusText("", "");
}

//Manipulates HTML and clears browser cookies for the website.
function simulateLogout() {
  $("#form_div").show();
  $("#table").hide();
  eraseCookie("access_token");
  eraseCookie("username");
}

//Generates the pages navigation buttons if there is more than one page.
function generatePaginationNav(current_page, pages) {
  var li_divs = "";

  if (current_page > 1) {
    li_divs += ('<li class="page-item"><a class="page-link" onclick="setPage(' + (current_page - 1) + ')">Previous</a></li>');
  }
  if (Math.max(1, current_page - 3) > 2) {
    li_divs += ('<li class="page-item"><a class="page-link" onclick="setPage(' + 1 + ')">1</a></li>');
    li_divs += ('<li class="page-item"><a class="page-link">..</a></li>');
  }
  for (let i = Math.max(1, current_page - 3); i < current_page + 4 && i <= pages; i++){
    li_divs += ('<li class="page-item' + (i == current_page ? " active " : "") + '"><a class="page-link" onclick="setPage(' + i + ')">' + i + '</a></li>');
  }
  if (current_page + 3 < pages - 1) {
    li_divs += ('<li class="page-item"><a class="page-link">..</a></li>');
    li_divs += ('<li class="page-item"><a class="page-link" onclick="setPage(' + pages + ')">' + pages + '</a></li>');
  }
  if (current_page < pages) {
    li_divs += ('<li class="page-item"><a class="page-link" onclick="setPage(' + (current_page + 1) + ')">Next</a></li>');
  }
  $(".pagination").html(li_divs);
}

//Used to track one shipment given a vin number.
function trackOneVin(vinNumber) {
  if (getCookie("access_token") == null) return;
  setStatusText("Loading...", "text-primary");
  displayStatus(vinNumber, shipments_array);
  /*
  $.ajax({
      url: (API_PATH_FL + "?fromDate=2000-01-01&toDate=" + dateTodayStr()),
      dataType: 'json',
      type: 'get',
      contentType: 'application/x-www-form-urlencoded',
      beforeSend: function (xhr) {
          xhr.setRequestHeader ("Authorization", "bearer " + getCookie("access_token"));
      },
      processData: false,
      success: function(data) {
        displayStatus(vinNumber, data.Results);
        
      },
      error: function(jqxhr) {
        simulateLogout();
        setStatusText("An error occurred.", "text-danger");
      }
    }
    );
    */
}

//Sets the status text for the requested single vin.
function displayStatus(vinNumber, shipments){
  for (let i = 0; i < shipments.length; i++){
    if (shipments[i].TrafficNo == vinNumber) {
      var single_array = [ shipments[i] ];
      var textclass;
      displayFreightLoads(single_array, 1, 1);
      if (shipments[i].Status === "DELIVERED") textclass = "text-success"; 
      else textclass = "text-primary";
      setStatusText(shipments[i].Status, textclass);
      $("#show_all_button").show();
      return;
    }
  }
  setStatusText("Not found", "text-danger");
  setPage(1);
}

//Helper function to set the status text for the requested single vin.
var lastTextClass = "";
function setStatusText(text, textclass) {
  $("#vinStatus").removeClass(lastTextClass);
  $("#vinStatus").addClass(textclass);
  $("#vinStatus").html(text);
  lastTextClass = textclass;
}

//Submits login information.
function submit() {
    var email = $("#email").val();
    var password = $("#password").val();
    getAccessToken(email, password);
}

//Submits vin number to track one shipment.
function single_tracker_submit() {
    trackOneVin($("#vinNumber").val().trim());
}

function startLoadingAnimation() {
    $(".loader").show();
    isLoading = true;
}

function stopLoadingAnimation() {
    $(".loader").hide();
    isLoading = false;
}

function showLoginError(message) {
    $("#msg").show();
    $("#msg").html(message);
}

function dateTodayStr() {
  var dateObj = new Date();
  var str = dateObj.getFullYear() + "-" + (dateObj.getMonth()+1) + "-" + dateObj.getDate(); 
  return str;
}

function getRowFieldsAsArray(row) {
  return [
    row.OrderNo, 
    row.TrafficNo, 
    row.CustomerRef, 
    row.Carrier, 
    row.PickupAt,
    row.Shipper, 
    formatDate(row.PickupDt), 
    row.DeliveryAt, 
    row.Consignee, 
    formatDate(row.DeliveryDt), 
    row.Status, 
    row.EquipmentNo, 
    row.InvoiceNo, 
    row.Oid
    ];
}


function setPage(page) {
  lastPage = page;
  displayFreightLoads(shipments_array, page, shipments_array_size);
}

//convert to csv

/*

function downloadCSV(){
  if (shipments_array == null) return;
  var filename = "vins-" + dateTodayStr();
  let csvContent = "data:text/csv;charset=utf-8,";
  for (let i = 0; i < shipments_array.length; i++){
    let fields = getRowFieldsAsArray(shipments_array[i]);
    let fieldsCommaSeparated = fields.join(",");
    csvContent += fieldsCommaSeparated + "\r\n";
  }
  window.open(encodeURI(csvContent));
}
*/