$(function () {
  $('.modal').modal();

  var path_login = 'https://api.e-com.plus/v1/_login.json?username';
  var path_product = 'https://api.e-com.plus/v1/products.json';
  var path_api = 'https://api.e-com.plus/v1';
  var _id;
  var _store_id;
  var _key;
  var _data;
  var _erro = [];
  var total = 0;
  var success = 0;
  var fail = 0;
  var pending = 0;
  var _currentSync = 0;
  var btn_login = $('#action-loggar');
  var btn_send = $('#action-request');
  var _input = $('#file');
  var result_element = $('#wrapper-result-content');

  _input.unbind('change').on('change', parse_cvs);
  btn_login.unbind('click').on('click', login);
  btn_send.unbind('click').on('click', insert_product);

  function parse_cvs() {
    $('input[type=file]').parse({
      config: {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          //
          _data = results['data'];
          table_element(results)
          total = _data.length
          pending = _data.length
          updateCounts()
          //
          $('#li-import').addClass('valid');
        }
      }
    });
  }

  function table_element(csv) {
    var content = '';

    csv['data'].forEach(function (element, chave) {

      content += `<ul class="collapsible popout" data-key="${chave}">
                    <li>
                      <div class="collapsible-header">Produto ${chave}</div>
                        <div class="collapsible-body">`;

      $.each(element, function (key, value) {

        content += `<div class="result-wrapper">
                      <div class="result-key">
                        ${key}
                      </div>
                      <div class="result-value">
                        ${value}
                      </div>
                    </div>`;
        return;
      });

      content += `    </div>
                  </li>
                </ul>`;

    });
    result_element.html(content);
    $('.collapsible').collapsible();
  }

  function login() {
    is_valid();
    var u = $('#username').val();
    var p = $('#password').val();
    p = md_5(p);

    $.ajax({
      type: "POST",
      url: path_login,
      headers: {
        'X-Store-ID': 1
      },
      data: JSON.stringify({
        username: u,
        pass_md5_hash: p
      }),
      contentType: "application/json",
      dataType: 'json'
    }).done(function (json) {
      // keep store ID
      _store_id = json.store_id;
      // authenticate
      $.ajax({
        url: 'https://api.e-com.plus/v1/_authenticate.json',
        method: 'POST',
        dataType: 'json',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          'X-Store-ID': _store_id
        },
        data: JSON.stringify({
          '_id': json._id,
          'api_key': json.api_key
        })
      }).done(logged)
        .fail(auth_fail)
    }).fail(auth_fail);
  }

  function auth_fail(erro) {
    erro = erro.responseJSON;
    $('#erro').html('<span>' + erro.user_message.pt_br + '</span>').show()
  }

  function verify_schema(item) {

    var current_item = Object.expand(item);
    var new_item = {};
    var rgx_array = /\[([^\]]+)\]/g;
    var rgx_array_empty = /\[()\]/;

    for (const key in current_item) {
      if (current_item.hasOwnProperty(key)) {
        if (current_item[key] !== '') {
          console.log(current_item[key])

          if (/\[([^\]]+)\]/g.test(key) === true) {
            console.log(key)
            console.log(current_item[key])
            new_item[key.replace(rgx_array, "")] = new_item[key.replace(rgx_array, "")] || [];
            new_item[key.replace(rgx_array, "")].push(current_item[key]);
            console.log(new_item)
          } else {
            if (typeof current_item[key] === 'object') {
              for (const chave in current_item[key]) {
                new_item[key] = new_item[key] || {};
                if (typeof current_item[key] === 'object') {
                  if (rgx_array.test(chave)) {
                    var index = chave.replace(rgx_array, "");
                    new_item[key][index] = new_item[key][index] || [];
                    new_item[key][index].push(current_item[key][chave]);
                  } else {
                    var index = chave.replace(rgx_array, "");
                    new_item[key][index] = current_item[key][chave];
                  }
                } else {
                  new_item[key] = current_item[key][chave];
                }
              }
            } else {
              var val = current_item[key];
              if (key === 'price') {
                val = Number(val)
              }
              new_item[key] = val
            }
          }
        }
      }
    }

    if (new_item._id) {
      delete new_item._id
    }

    return JSON.stringify(new_item);
  }

  function insert_product() {

    if (!_data) {
      console.log('Importação vazia. Importe CSV.');
      return;
    }

    if (!_store_id && !_id && !_key) {
      console.log('Login é necessário.');
      return;
    }

    recursiveRequest(_data)
  }

  function recursiveRequest(data) {
    console.log('Envio recursivo')
    var url = ''
    var method = ''
    if (data[_currentSync]._id) {
      url = `https://api.e-com.plus/v1/products/${data[_currentSync]._id}.json`
      method = 'PATCH'
    } else {
      url = 'https://api.e-com.plus/v1/products.json'
      method = 'POST'
    }

    var options = {
      type: method,
      url,
      headers: {
        'X-Store-ID': _store_id,
        'X-Access-Token': _key,
        'X-My-Id': _id
      },
      data: verify_schema(data[_currentSync]),
      contentType: 'application/json',
      dataType: 'json'
    }

    if (data[_currentSync]) {
      $.ajax(options)
        .done(function (r) {
          success++
          pending--
          updateCounts()
          $(`ul[data-key="${_currentSync}"] .collapsible-header`).css('background-color', '#4caf50')
          recursiveRequest(data)
        }).fail(function (e) {
          console.log(e)
          fail++
          pending--
          updateCounts()
          $(`ul[data-key="${_currentSync}"] .collapsible-header`).css('background-color', '#B71C1C')
          $(`<div class="erros"><p>${e.responseJSON.user_message.pt_br}</p></div>`).appendTo($(`ul[data-key="${_currentSync}"] li`))
          recursiveRequest(data)
        })
      _currentSync++
    } else {
      console.log('FIM')
    }
  }

  function is_valid() {
    $('#erro').hide();
    if (!$('#username').val() && !$('#password').val()) {
      $('#erro').html('<span>Verifique os campos obrigatórios.</span>').show()
      return;
    }
  }

  function logged(res) {
    _id = res.my_id;
    _key = res.access_token;
    $('.modal').modal('close');
    $('#li-store-id .li-value').text(_id);
    $('#li-store-user .li-value').text(_store_id);
    $('#li-store-auth .li-value').text(_key);

    $('.store-list').css('display', 'block');
    $('#li-login').addClass('valid');
    $('#li-request').addClass('valid');

  }

  function updateCounts() {
    $('#li-all .li-value').text(total)
    $('#li-complete .li-value').text(success)
    $('#li-in-progress .li-value').text(pending)
    $('#li-erro .li-value').text(fail)
  }

  function parseDotNotation(str, val, obj) {
    var currentObj = obj, //objeto atual
      keys = str.split("."), // explode '.' da chave e transforma em array
      i, l = Math.max(1, keys.length - 1), // set o tamanho do array das array em l
      key;

    for (i = 0; i < l; ++i) {
      key = keys[i];//.replace(/[\[\].!'@,><|://\\;&*()+=]/g, ""); // remove [] das chaves e seta a atual em key
      currentObj[key] = currentObj[key] || {}; // se não existir cria novo obj
      currentObj = currentObj[key]; // atual objeto recebe ele
    }
    var reg = /^-?\d+\,?\.?\d*$/; // verificar se é 0,00 ou 0.00
    if (reg.test(val)) {
      console.log(val)
      currentObj[keys[i]] = parseFloat(val.replace(',', '.').trim());
    } else {
      currentObj[keys[i]] = val.trim();    // objeto com a chave na posição de i recebe o valor 
    }
    delete obj[str];
  }

  Object.expand = function (obj) {
    for (var key in obj) { // percorre csv
      if (key.indexOf(".") !== -1) {
        parseDotNotation(key, obj[key], obj); // chave, valor_do_objeto[chave], objeto
      }
    }
    return obj;
  };

  function md_5(d) { result = M(V(Y(X(d), 8 * d.length))); return result.toLowerCase() }; function M(d) { for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++)_ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _); return f } function X(d) { for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++)_[m] = 0; for (m = 0; m < 8 * d.length; m += 8)_[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32; return _ } function V(d) { for (var _ = "", m = 0; m < 32 * d.length; m += 8)_ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255); return _ } function Y(d, _) { d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _; for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) { var h = m, t = f, g = r, e = i; f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e) } return Array(m, f, r, i) } function md5_cmn(d, _, m, f, r, i) { return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m) } function md5_ff(d, _, m, f, r, i, n) { return md5_cmn(_ & m | ~_ & f, d, _, r, i, n) } function md5_gg(d, _, m, f, r, i, n) { return md5_cmn(_ & f | m & ~f, d, _, r, i, n) } function md5_hh(d, _, m, f, r, i, n) { return md5_cmn(_ ^ m ^ f, d, _, r, i, n) } function md5_ii(d, _, m, f, r, i, n) { return md5_cmn(m ^ (_ | ~f), d, _, r, i, n) } function safe_add(d, _) { var m = (65535 & d) + (65535 & _); return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m } function bit_rol(d, _) { return d << _ | d >>> 32 - _ }

});
