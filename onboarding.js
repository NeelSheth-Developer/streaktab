/**
 * StreakTab - Onboarding
 * Asks for name and age group before showing the main dashboard
 */

(() => {
  const STORAGE_KEYS = {
    ONBOARDING_DONE: 'streaktab_onboarding_done',
    USER_NAME: 'streaktab_user_name',
    AGE_GROUP: 'streaktab_age_group'
  };

  async function isOnboardingDone() {
    const { [STORAGE_KEYS.ONBOARDING_DONE]: done } = await chrome.storage.local.get(STORAGE_KEYS.ONBOARDING_DONE);
    return !!done;
  }

  async function completeOnboarding(name, ageGroup) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.ONBOARDING_DONE]: true,
      [STORAGE_KEYS.USER_NAME]: name.trim(),
      [STORAGE_KEYS.AGE_GROUP]: ageGroup
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const overlay = document.getElementById('onboardingOverlay');
    const mainApp = document.getElementById('mainApp');
    const form = document.getElementById('onboardingForm');

    if (await isOnboardingDone()) {
      overlay.classList.add('hidden');
      mainApp.classList.remove('hidden');
      // Sidebar opens only when user clicks the tracker icon in the rail
      return;
    }

    overlay.classList.remove('hidden');
    const sidebar = document.getElementById('fitnessSidebar');
    if (sidebar) {
      sidebar.classList.add('closed');
      sidebar.classList.remove('open');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('onboardingName').value.trim();
      const ageGroup = document.getElementById('onboardingAge').value;
      if (!name || !ageGroup) return;

      await completeOnboarding(name, ageGroup);
      overlay.classList.add('hidden');
      mainApp.classList.remove('hidden');
      // Sidebar opens only when user clicks the tracker icon in the rail

      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.textContent = name;
    });
  });
})();
