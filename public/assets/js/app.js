/*
 * Acopify - Main application logic
 */

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  renderWelcome();
}

function renderWelcome() {
  const main = document.getElementById("app");
  if (!main) return;

  main.innerHTML = `
    <section class="text-center py-20 px-4">
      <h2 class="text-4xl font-bold text-gray-900 mb-4">
        Welcome to Acopify
      </h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
        An open-source web application powered by Firebase.
      </p>
      <div class="flex justify-center gap-4">
        <a href="https://github.com/voftec/Acopify"
           target="_blank"
           rel="noopener noreferrer"
           class="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors">
          <i data-lucide="github"></i>
          View on GitHub
        </a>
      </div>
    </section>

    <section class="max-w-4xl mx-auto px-4 py-12">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
            <i data-lucide="database" class="w-5 h-5 text-orange-600"></i>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Realtime Database</h3>
          <p class="text-sm text-gray-600">
            Powered by Firebase RTDB for real-time data synchronization.
          </p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <i data-lucide="globe" class="w-5 h-5 text-blue-600"></i>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Firebase Hosting</h3>
          <p class="text-sm text-gray-600">
            Fast, secure hosting with global CDN distribution.
          </p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <i data-lucide="code" class="w-5 h-5 text-green-600"></i>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Open Source</h3>
          <p class="text-sm text-gray-600">
            MIT licensed. Contribute and customize freely.
          </p>
        </div>
      </div>
    </section>
  `;

  if (window.lucide) {
    lucide.createIcons();
  }
}
