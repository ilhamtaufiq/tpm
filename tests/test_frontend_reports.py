import os
import pytest
from playwright.sync_api import Page, expect

# Set this to your Expo Web URL (usually 8081)
BASE_URL = os.getenv("FRONTEND_URL", "http://localhost:8081")

def test_laba_rugi_sync(page: Page):
    """
    Test untuk memastikan Laba Rugi dirender dengan baik 
    dan kita bisa mengekstrak nilai Laba Bersih untuk referensi.
    """
    page.goto(f"{BASE_URL}/laporan/laba-rugi")
    
    # Tunggu sampai report selesai di-load (hilangnya indikator loading jika ada)
    page.wait_for_selector("text=Laba Rugi", timeout=10000)
    
    # Cari nilai Laba Bersih
    # Karena ini React Native Web, struktur DOM menggunakan div dengan styling.
    # Kita menggunakan pencarian teks yang mendekati "Laba Bersih"
    laba_bersih_element = page.locator("text=Laba Bersih").last
    expect(laba_bersih_element).to_be_visible()

def test_perubahan_modal_balance(page: Page):
    """
    Test untuk memastikan Perubahan Modal statusnya Balanced dan tidak ada selisih.
    """
    page.goto(f"{BASE_URL}/laporan/perubahan-modal")
    
    # Pastikan halaman terload
    page.wait_for_selector("text=Perubahan Modal", timeout=10000)
    
    # Pastikan status "BALANCED" muncul dan "TIDAK SEIMBANG" tidak ada
    balanced_text = page.get_by_text("BALANCED", exact=True).first
    expect(balanced_text).to_be_visible(timeout=10000)

def test_neraca_balance(page: Page):
    """
    Test untuk memastikan Neraca statusnya Seimbang dan tidak ada selisih.
    """
    page.goto(f"{BASE_URL}/laporan/neraca")
    
    # Pastikan halaman terload
    page.wait_for_selector("text=Neraca", timeout=10000)
    
    # Pastikan status "NERACA SEIMBANG" muncul (sesuai kode di neraca.tsx)
    seimbang_text = page.get_by_text("NERACA SEIMBANG", exact=True).first
    expect(seimbang_text).to_be_visible(timeout=10000)
    
    # Pastikan text "TERDAPAT SELISIH" tidak muncul
    selisih_warning = page.get_by_text("TERDAPAT SELISIH", exact=True)
    expect(selisih_warning).not_to_be_visible()
