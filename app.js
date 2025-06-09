
// Firebase & مكتبات التصدير
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import * as jspdf from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
import * as docx from 'https://cdn.jsdelivr.net/npm/docx@7.7.0/build/index.min.js';

const firebaseConfig = {
  apiKey: "AIzaSyCqOK8dAsYVd3G5kv6rFbrkDfLhmgFOXAU",
  authDomain: "flight-scheduler-3daea.firebaseapp.com",
  projectId: "flight-scheduler-3daea",
  storageBucket: "flight-scheduler-3daea.appspot.com",
  messagingSenderId: "1036581965112",
  appId: "1:1036581965112:web:0bd21e436764ea4294c5cd",
  measurementId: "G-ZC0843FNX8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const adminEmail = "AhmedalTalqani@gmail.com";

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadFlightApp();
  } else {
    showLoginForm();
  }
});

function showLoginForm() {
  document.getElementById('app').innerHTML = `
    <h2>تسجيل الدخول</h2>
    <input id="email" placeholder="البريد الإلكتروني"><br>
    <input id="password" type="password" placeholder="كلمة المرور"><br>
    <button onclick="login()">دخول</button>
    <div id="output"></div>
  `;
}

window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    const output = document.getElementById("output");
    if (output) output.innerHTML = "<b>تم تسجيل الدخول</b>";
  } catch {
    const output = document.getElementById("output");
    if (output) output.innerText = "فشل تسجيل الدخول";
  }
};

window.logout = async function () {
  await signOut(auth);
  showLoginForm();
};

function loadFlightApp() {
  const user = auth.currentUser;
  const isAdmin = user && user.email === adminEmail;

  let formHTML = "";
  for (let i = 1; i <= 5; i++) {
    formHTML += `
      <fieldset style="margin-bottom: 15px;">
        <legend>الرحلة ${i}</legend>
        <input placeholder="رقم الرحلة" id="fltno${i}"><br>
        <input placeholder="ON chocks Time" id="onchocks${i}"><br>
        <input placeholder="Open Door Time" id="opendoor${i}"><br>
        <input placeholder="Start Cleaning Time" id="cleanstart${i}"><br>
        <input placeholder="Complete Cleaning Time" id="cleanend${i}"><br>
        <input placeholder="Ready Boarding Time" id="ready${i}"><br>
        <input placeholder="Start Boarding Time" id="boardingstart${i}"><br>
        <input placeholder="Complete Boarding Time" id="boardingend${i}"><br>
        <input placeholder="Close Door Time" id="closedoor${i}"><br>
        <input placeholder="Off chocks Time" id="offchocks${i}"><br>
        <input placeholder="الاسم" id="name${i}"><br>
        <input placeholder="ملاحظات" id="notes${i}"><br>
        <input type="date" id="date${i}"><br>
      </fieldset>
    `;
  }

  let counterSection = isAdmin ? `<h3>📊 عداد الرحلات بالشهر (للمسؤول)</h3><div id="monthlyCounter"></div>` : "";

  document.getElementById("app").innerHTML = `
    <button onclick="logout()" style="float:left;">🔓 تسجيل الخروج</button>
    <h2>إضافة 5 رحلات</h2>
    ${formHTML}
    <button onclick="saveFlights()">💾 حفظ الرحلات</button>
    <hr>
    <h2>رحلات اليوم</h2>
    <input id="filterName" placeholder="فلترة حسب الاسم" oninput="loadFlights()"><br>
    <button onclick="exportToPDF()">📤 تصدير PDF</button>
    <button onclick="exportToWord()">📄 تصدير Word</button>
    <div id="flightsTable"></div>
    ${counterSection}
  `;

  loadFlights();
}

window.saveFlights = async function () {
  let savedCount = 0;
  for (let i = 1; i <= 5; i++) {
    const fields = [
      `fltno${i}`, `onchocks${i}`, `opendoor${i}`, `cleanstart${i}`, `cleanend${i}`,
      `ready${i}`, `boardingstart${i}`, `boardingend${i}`, `closedoor${i}`,
      `offchocks${i}`, `name${i}`, `notes${i}`, `date${i}`
    ];
    let hasData = false;
    const data = {};
    fields.forEach(fieldId => {
      const value = document.getElementById(fieldId).value.trim();
      data[fieldId.replace(i, "")] = value;
      if (value !== "") hasData = true;
    });
    if (hasData) {
      await addDoc(collection(db, "flights"), data);
      savedCount++;
    }
  }
  alert(savedCount > 0 ? `✅ تم حفظ ${savedCount} رحلة` : "⚠️ لم يتم حفظ أي رحلة (كل الحقول فارغة)");
  loadFlights();
};

window.loadFlights = async function () {
  const nameFilter = document.getElementById("filterName").value.trim();
  const q = nameFilter ? query(collection(db, "flights"), where("name", "==", nameFilter)) : collection(db, "flights");
  const snapshot = await getDocs(q);
  let html = `<table><tr><th>الاسم</th><th>الرحلة</th><th>ON</th><th>Open</th><th>Ready</th><th>Close</th><th>OFF</th><th>التاريخ</th><th>🗑️</th></tr>`;
  const monthlyCount = {};
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const monthKey = (d.date || "").slice(0, 7);
    const nameKey = d.name || "غير معروف";
    const userMonthKey = `${nameKey} - ${monthKey}`;
    monthlyCount[userMonthKey] = (monthlyCount[userMonthKey] || 0) + 1;
    html += `
      <tr>
        <td>${d.name || ""}</td><td>${d.fltno || ""}</td><td>${d.onchocks || ""}</td>
        <td>${d.opendoor || ""}</td><td>${d.ready || ""}</td><td>${d.closedoor || ""}</td>
        <td>${d.offchocks || ""}</td><td>${d.date || ""}</td>
        <td><button onclick="deleteFlight('${docSnap.id}')">🗑️</button></td>
      </tr>
    `;
  });
  html += "</table>";
  document.getElementById("flightsTable").innerHTML = html;

  const counterDiv = document.getElementById("monthlyCounter");
  if (counterDiv) {
    let counterHtml = "<ul>";
    for (const key in monthlyCount) {
      counterHtml += `<li>${key} ➤ ${monthlyCount[key]} رحلة</li>`;
    }
    counterHtml += "</ul>";
    counterDiv.innerHTML = counterHtml;
  }
};

window.deleteFlight = async function (id) {
  if (confirm("هل أنت متأكد من حذف الرحلة؟")) {
    await deleteDoc(doc(db, "flights", id));
    loadFlights();
  }
};

window.exportToPDF = async function () {
  const snapshot = await getDocs(collection(db, "flights"));
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  let y = 10;
  snapshot.forEach((docSnap, index) => {
    const d = docSnap.data();
    doc.text(`رحلة ${index + 1}: ${d.name || ""} - ${d.fltno || ""} - ${d.date || ""}`, 10, y);
    y += 10;
    if (y > 270) {
      doc.addPage();
      y = 10;
    }
  });
  doc.save("flights.pdf");
};

window.exportToWord = async function () {
  const snapshot = await getDocs(collection(db, "flights"));
  const { Document, Packer, Paragraph, TextRun } = docx;
  const doc = new Document();
  const children = [];
  snapshot.forEach((docSnap, index) => {
    const d = docSnap.data();
    children.push(new Paragraph({
      children: [
        new TextRun(`رحلة ${index + 1}: ${d.name || ""} - ${d.fltno || ""} - ${d.date || ""}`)
      ]
    }));
  });
  doc.addSection({ children });
  const blob = await Packer.toBlob(doc);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "flights.docx";
  link.click();
};
