// Admin store.
//
// Admin-only actions, split out of orders.js (where they never belonged): managing
// student account status (approve / block / remove) and adding campus venues.
// Behaviour is preserved exactly from the old orders-store versions — same api
// calls, the same ui.run() busy-guard + error toast, and the same catalog updates.
import { defineStore } from "pinia";
import { api } from "@/services/api.js";
import { useUiStore } from "./ui.js";
import { useCatalogStore } from "./catalog.js";

export const useAdminStore = defineStore("admin", () => {
  /* student account status */
  async function setStudentStatus(userId, status) {
    const ui = useUiStore();
    const catalog = useCatalogStore();
    const saved = await ui.run(userId, () =>
      api.setProfileStatus(userId, status),
    );
    if (saved) Object.assign(catalog.user(userId), saved);
  }
  const approveStudent = (id) => setStudentStatus(id, "active");
  const blockStudent = (id) => setStudentStatus(id, "blocked");
  const removeStudent = (id) => setStudentStatus(id, "removed");

  /* venues: add one by clicking the map (draft lives in ui.ui.staff) */
  async function addVenue() {
    const ui = useUiStore();
    const catalog = useCatalogStore();
    const t = ui.ui.staff;
    const d = t.venueDraft;
    const lat = parseFloat(d.lat);
    const lng = parseFloat(d.lng);
    if (!d.name.trim()) {
      t.formError = "Give the venue a name.";
      return;
    }
    if (!(lat > 1.15 && lat < 1.48 && lng > 103.6 && lng < 104.1)) {
      t.formError = "Click the map to place the pin inside Singapore.";
      return;
    }
    t.saving = true;
    try {
      const v = await api.addVenue({
        name: d.name.trim(),
        lat,
        lng,
        type: "eatery",
      });
      catalog.db.venues.push(v);
      t.venueDraft = { name: "", lat: "", lng: "" };
    } catch (err) {
      t.formError = err.message;
    } finally {
      t.saving = false;
    }
  }

  return {
    setStudentStatus,
    approveStudent,
    blockStudent,
    removeStudent,
    addVenue,
  };
});
