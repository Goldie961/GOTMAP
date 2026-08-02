# Raport Execuție Split Entități Comasate (§9.4)

**Data execuției:** 2026-08-02 13:26:15

- **Total personaje inițiale:** 2312
- **Entități comasate șterse (split):** 76
### #1. PERSON_AEGON_TARGARYEN_AEGON_STAPANUL_DRAGONILOR (`false_positive`)
- **App ID:** `aegon_targaryen_aegon_stapanul_dragonilor`
- **Nume canonic setat:** `Aegon Targaryen (Cuceritorul)`
- **Alias adăugat:** `Aegon, Stăpânul Dragonilor`
- **Note:** Aceeași persoană (Aegon I) — a doua jumătate e o poreclă/titlu, nu altă persoană.

- **Personaje noi create:** 52
- **Personaje existente îmbogățite cu surse noi:** 102
- **False positive ajustate:** 6
- **Uncertain trimise la review:** 4
- **Total personaje final în characters.json:** 2288 (Calcul: 2312 - 76 + 52 = 2288)

---


### #2. PERSON_AGGO_RAKHARO (`split`)
- **App ID comasat șters:** `aggo_rakharo`
- **Nume sparte:** ['Aggo', 'Rakharo']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['aggo', 'rakharo']`

### #3. PERSON_ALAYNE_ROYCE_SI_SAMANTHA_STOKEWORTH (`split`)
- **App ID comasat șters:** `alayne_royce_si_samantha_stokeworth`
- **Nume sparte:** ['Alayne Royce', 'Samantha Stokeworth']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['alayne_royce', 'samantha_stokeworth']`

### #4. PERSON_ALLISER_THORNE_JANOS_SLYNT (`split`)
- **App ID comasat șters:** `alliser_thorne_janos_slynt`
- **Nume sparte:** ['Alliser Thorne', 'Janos Slynt']
- **ID-uri create noi:** `['alliser_thorne']`
- **ID-uri existente re-utilizate/îmbogățite:** `['janos_slynt']`

### #5. PERSON_ALTI_VERI_AI_LUI_VALARR_SI_MATARYS (`uncertain`)
- **App ID:** `alti_veri_ai_lui_valarr_si_matarys`
- **Motiv:** "Alți veri ai lui Valarr și Matarys (nenumiți)" descrie o RUDĂ NENUMITĂ a doi oameni deja numiți (Valarr, Matarys) — nu sunt 2 persoane numite "Alți veri" și "Matarys". Nu se poate crea o intrare de persoană validă din asta fără decizie manuală despre cum se tratează.
- **Acțiune:** Păstrat nemodificat, adăugat în review.

### #6. PERSON_ARON_SANTAGAR_JALABHAR_XHO_GEMENII_REDWYNE_LORDUL_GYLES_SER_DONTOS_SER_BALON_SWANN (`split`)
- **App ID comasat șters:** `aron_santagar_jalabhar_xho_gemenii_redwyne_lordul_gyles_ser_dontos_ser_balon_swann`
- **Nume sparte:** ['Aron Santagar', 'Jalabhar Xho', 'Oroare Redwyne', 'Bălosul Redwyne', 'Lordul Gyles', 'Ser Dontos', 'Ser Balon Swann']
- **ID-uri create noi:** `['oroare_redwyne', 'balosul_redwyne', 'lordul_gyles']`
- **ID-uri existente re-utilizate/îmbogățite:** `['aron_santagar', 'jalabhar_xho', 'ser_dontos', 'ser_balon_swann']`

### #7. PERSON_ARYA_STARK_GENDRY (`split`)
- **App ID comasat șters:** `arya_stark_gendry`
- **Nume sparte:** ['Arya Stark', 'Gendry']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['arya_stark', 'gendry']`

### #8. PERSON_BAELA_SI_RHAENA_TARGARYEN (`split`)
- **App ID comasat șters:** `baela_si_rhaena_targaryen`
- **Nume sparte:** ['Baela Targaryen', 'Rhaena Targaryen']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['baela_targaryen', 'rhaena_targaryen']`

### #9. PERSON_BANNEN_DYWEN (`split`)
- **App ID comasat șters:** `bannen_dywen`
- **Nume sparte:** ['Bannen', 'Dywen']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['bannen', 'dywen']`

### #10. PERSON_BATRANUL_FLINT_NORREY (`split`)
- **App ID comasat șters:** `batranul_flint_norrey`
- **Nume sparte:** ['Bătrânul Flint', 'Norrey']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['batranul_flint', 'norrey']`

### #11. PERSON_BOWEN_MARSH_OTHELL_YARWYCK (`split`)
- **App ID comasat șters:** `bowen_marsh_othell_yarwyck`
- **Nume sparte:** ['Bowen Marsh', 'Othell Yarwyck']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['bowen_marsh', 'othell_yarwyck']`

### #12. PERSON_BRANDON_STARK_MENTIONAT_CA_STRANGULANDU_SE_INCERCAND_SA_SI_SALVEZE_TATAL (`false_positive`)
- **App ID:** `brandon_stark_mentionat_ca_strangulandu_se_incercand_sa_si_salveze_tatal`
- **Nume canonic setat:** `Brandon Stark (unchiul lui Ned)`
- **Alias adăugat:** `mort înainte de acțiunea seriei, strangulat încercând să-și salveze tatăl`
- **Note:** Un singur personaj descris pe o propoziție lungă; algoritmul a rupt greșit la virgule.

### #13. PERSON_BRAN_STARK_RICKON_STARK (`split`)
- **App ID comasat șters:** `bran_stark_rickon_stark`
- **Nume sparte:** ['Bran Stark', 'Rickon Stark']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['bran_stark', 'rickon_stark']`

### #14. PERSON_BRAN_STARK_SI_RICKON_STARK (`split`)
- **App ID comasat șters:** `bran_stark_si_rickon_stark`
- **Nume sparte:** ['Bran Stark', 'Rickon Stark']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['bran_stark', 'rickon_stark']`

### #15. PERSON_BRUSCO_SI_FIICELE_SALE (`split`)
- **App ID comasat șters:** `brusco_si_fiicele_sale`
- **Nume sparte:** ['Brusco', 'Brea', 'Talea']
- **ID-uri create noi:** `['brea', 'talea']`
- **ID-uri existente re-utilizate/îmbogățite:** `['brusco']`

### #16. PERSON_BUTTERBUMPS_SI_BAIATUL_LUNII (`split`)
- **App ID comasat șters:** `butterbumps_si_baiatul_lunii`
- **Nume sparte:** ['Butterbumps', 'Băiatul Lunii']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['butterbumps', 'baiatul_lunii']`

### #17. PERSON_CALUL_RORY (`split`)
- **App ID comasat șters:** `calul_rory`
- **Nume sparte:** ['Calul', 'Rory']
- **ID-uri create noi:** `['calul']`
- **ID-uri existente re-utilizate/îmbogățite:** `['rory']`

### #18. PERSON_CALUL_SI_ROBIN_HOP (`split`)
- **App ID comasat șters:** `calul_si_robin_hop`
- **Nume sparte:** ['Calul', 'Robin-Hop']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['calul', 'robin_hop']`

### #19. PERSON_CIOCAN_SI_UNGHIE (`split`)
- **App ID comasat șters:** `ciocan_si_unghie`
- **Nume sparte:** ['Ciocan', 'Unghie']
- **ID-uri create noi:** `['ciocan', 'unghie']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #20. PERSON_CLEON_SI_CLEON_AL_DOILEA (`split`)
- **App ID comasat șters:** `cleon_si_cleon_al_doilea`
- **Nume sparte:** ['Cleon', 'Cleon al Doilea']
- **ID-uri create noi:** `['cleon', 'cleon_al_doilea']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #21. PERSON_DAEMION_SI_DAERON_VELARYON (`split`)
- **App ID comasat șters:** `daemion_si_daeron_velaryon`
- **Nume sparte:** ['Daemion Velaryon', 'Daeron Velaryon']
- **ID-uri create noi:** `['daemion_velaryon']`
- **ID-uri existente re-utilizate/îmbogățite:** `['daeron_velaryon']`

### #22. PERSON_DAKE_SI_ROLDER (`split`)
- **App ID comasat șters:** `dake_si_rolder`
- **Nume sparte:** ['Dake', 'Rolder']
- **ID-uri create noi:** `['rolder']`
- **ID-uri existente re-utilizate/îmbogățite:** `['dake']`

### #23. PERSON_DALIA_SI_MATRICE (`split`)
- **App ID comasat șters:** `dalia_si_matrice`
- **Nume sparte:** ['Dalia', 'Matrice']
- **ID-uri create noi:** `['matrice']`
- **ID-uri existente re-utilizate/îmbogățite:** `['dalia']`

### #24. PERSON_DAMON_DANSEAZA_PENTRU_MINE_JUPUITORUL_ALYN_URSUZUL_DICK_GALBEJITUL_LUTON_MARAITUL_BAIETII_BASTARDULUI_AI_LUI_RAMSAY_BOLTON_DICK_GALBEJITUL_GASIT_MORT_SI_MUTILAT_PAGINA_815_823 (`split`)
- **App ID comasat șters:** `damon_danseaza_pentru_mine_jupuitorul_alyn_ursuzul_dick_galbejitul_luton_maraitul_baietii_bastardului_ai_lui_ramsay_bolton_dick_galbejitul_gasit_mort_si_mutilat_pagina_815_823`
- **Nume sparte:** ['Damon Dansează-pentru-Mine', 'Jupuitorul', 'Alyn Ursuzul', 'Dick Gălbejitul', 'Luton', 'Mârâitul']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['damon_danseaza_pentru_mine', 'jupuitorul', 'alyn_ursuzul', 'dick_galbejitul', 'luton', 'maraitul']`

### #25. PERSON_DORCAS_SI_JOCELYN (`split`)
- **App ID comasat șters:** `dorcas_si_jocelyn`
- **Nume sparte:** ['Dorcas', 'Jocelyn']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['dorcas', 'jocelyn']`

### #26. PERSON_DYWEN_HAKE (`split`)
- **App ID comasat șters:** `dywen_hake`
- **Nume sparte:** ['Dywen', 'Hake']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['dywen', 'hake']`

### #27. PERSON_ELADON_PAR_AURIU_SULITA_CREDINCIOASA (`uncertain`)
- **App ID:** `eladon_par_auriu_sulita_credincioasa`
- **Motiv:** "Eladon Păr Auriu, Suliţa Credincioasă" — posibil nume+poreclă ale ACELEIAȘI persoane (ca la Aegon/Styr), posibil 2 persoane. Nu am suficientă certitudine din text.
- **Acțiune:** Păstrat nemodificat, adăugat în review.

### #28. PERSON_ERRYK_SI_ARRYK (`split`)
- **App ID comasat șters:** `erryk_si_arryk`
- **Nume sparte:** ['Erryk', 'Arryk']
- **ID-uri create noi:** `['erryk', 'arryk']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #29. PERSON_GALHART_GLOVER_SI_ROBERT_GLOVER (`split`)
- **App ID comasat șters:** `galhart_glover_si_robert_glover`
- **Nume sparte:** ['Galhart Glover', 'Robert Glover']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['galhart_glover', 'robert_glover']`

### #30. PERSON_GRENN_EDD_CEL_TRIST (`split`)
- **App ID comasat șters:** `grenn_edd_cel_trist`
- **Nume sparte:** ['Grenn', 'Edd cel Trist']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['grenn', 'edd_cel_trist']`

### #31. PERSON_GRIGG_TAPUL_ERROK (`split`)
- **App ID comasat șters:** `grigg_tapul_errok`
- **Nume sparte:** ['Grigg Ţapul', 'Errok']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['grigg_tapul', 'errok']`

### #32. PERSON_GRUP_DE_PERSOANE_DAGMER_FALCA_DESPICATA (`false_positive`)
- **App ID:** `grup_de_persoane_dagmer_falca_despicata`
- **Nume canonic setat:** `Dagmer Falcă Despicată`
- **Alias adăugat:** `Dagmer Cleftjaw`
- **Note:** O singură persoană — "Falcă Despicată" e porecla lui Dagmer, nu altă persoană.

### #33. PERSON_GRUP_DE_PERSOANE_GARISS_MURCH (`split`)
- **App ID comasat șters:** `grup_de_persoane_gariss_murch`
- **Nume sparte:** ['Gariss', 'Murch']
- **ID-uri create noi:** `['gariss', 'murch']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #34. PERSON_GRUP_DE_PERSOANE_IRRI_JHIQUI (`split`)
- **App ID comasat șters:** `grup_de_persoane_irri_jhiqui`
- **Nume sparte:** ['Irri', 'Jhiqui']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['irri', 'jhiqui']`

### #35. PERSON_GRUP_DE_PERSOANE_LADY_TANDA_LOLLYS_SI_FALYSE (`split`)
- **App ID comasat șters:** `grup_de_persoane_lady_tanda_lollys_si_falyse`
- **Nume sparte:** ['Lady Tanda', 'Lollys Stokeworth', 'Falyse Stokeworth']
- **ID-uri create noi:** `['falyse_stokeworth']`
- **ID-uri existente re-utilizate/îmbogățite:** `['lady_tanda', 'lollys_stokeworth']`

### #36. PERSON_GRUP_DE_PERSOANE_MIKKEN_BENFRED (`split`)
- **App ID comasat șters:** `grup_de_persoane_mikken_benfred`
- **Nume sparte:** ['Mikken', 'Benfred Tallhart']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['mikken', 'benfred_tallhart']`

### #37. PERSON_HALDER_BROSCOIUL (`split`)
- **App ID comasat șters:** `halder_broscoiul`
- **Nume sparte:** ['Halder', 'Broscoiul (Todder)']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['halder', 'broscoiul']`

### #38. PERSON_HARLE_VANATORUL_HARLE_FRUMUSELUL (`split`)
- **App ID comasat șters:** `harle_vanatorul_harle_frumuselul`
- **Nume sparte:** ['Harle Vânătorul', 'Harle Frumușelul']
- **ID-uri create noi:** `['harle_vanatorul', 'harle_frumuselul']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #39. PERSON_HEWARD_SI_WYL (`split`)
- **App ID comasat șters:** `heward_si_wyl`
- **Nume sparte:** ['Heward', 'Wyl']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['heward', 'wyl']`

### #40. PERSON_HOLLY_ROWAN (`split`)
- **App ID comasat șters:** `holly_rowan`
- **Nume sparte:** ['Holly', 'Rowan']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['holly', 'rowan']`

### #41. PERSON_HORAS_REDWYNE_HOBBER_REDWYNE (`split`)
- **App ID comasat șters:** `horas_redwyne_hobber_redwyne`
- **Nume sparte:** ['Horas Redwyne', 'Hobber Redwyne']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['horas_redwyne', 'hobber_redwyne']`

### #42. PERSON_IRRI_JHIQUI (`split`)
- **App ID comasat șters:** `irri_jhiqui`
- **Nume sparte:** ['Irri', 'Jhiqui']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['irri', 'jhiqui']`

### #43. PERSON_JENNIS_DIN_CASA_TEMPLETON_ROSAMUND_DIN_CASA_BALL (`split`)
- **App ID comasat șters:** `jennis_din_casa_templeton_rosamund_din_casa_ball`
- **Nume sparte:** ['Jennis din Casa Templeton', 'Rosamund din Casa Ball']
- **ID-uri create noi:** `['jennis_din_casa_templeton', 'rosamund_din_casa_ball']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #44. PERSON_JYCK_SI_MORREC (`split`)
- **App ID comasat șters:** `jyck_si_morrec`
- **Nume sparte:** ['Jyck', 'Morrec']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['jyck', 'morrec']`

### #45. PERSON_KHRAZZ_SI_PIELE_DE_OTEL (`split`)
- **App ID comasat șters:** `khrazz_si_piele_de_otel`
- **Nume sparte:** ['Khrazz', 'Piele-de-Oţel']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['khrazz', 'piele_de_otel']`

### #46. PERSON_LEATHERS_SI_JAX (`split`)
- **App ID comasat șters:** `leathers_si_jax`
- **Nume sparte:** ['Leathers', 'Jax']
- **ID-uri create noi:** `['jax']`
- **ID-uri existente re-utilizate/îmbogățite:** `['leathers']`

### #47. PERSON_LEW_MANA_STANGA_ALF_RUNNYMUDD (`split`)
- **App ID comasat șters:** `lew_mana_stanga_alf_runnymudd`
- **Nume sparte:** ['Lew Mână-Stângă', 'Alf Runnymudd']
- **ID-uri create noi:** `['lew_mana_stanga', 'alf_runnymudd']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #48. PERSON_LHARYS_SI_MOHOR (`split`)
- **App ID comasat șters:** `lharys_si_mohor`
- **Nume sparte:** ['Lharys', 'Mohor']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['lharys', 'mohor']`

### #49. PERSON_LIDDLE_CEL_MARE_SI_LUKE_DIN_ORASUL_LUNG (`split`)
- **App ID comasat șters:** `liddle_cel_mare_si_luke_din_orasul_lung`
- **Nume sparte:** ['Liddle cel Mare', 'Luke din Orașul Lung']
- **ID-uri create noi:** `['luke_din_orasul_lung']`
- **ID-uri existente re-utilizate/îmbogățite:** `['liddle_cel_mare']`

### #50. PERSON_LORDUL_BRYNDEMERE_EVENSTARUL (`uncertain`)
- **App ID:** `lordul_bryndemere_evenstarul`
- **Motiv:** "lordul Bryndemere, Evenstarul" — neclar dacă "Evenstarul" (titlul casei Estermont) se referă la Bryndemere însuși sau la o a doua persoană. Necesită verificare în text.
- **Acțiune:** Păstrat nemodificat, adăugat în review.

### #51. PERSON_LORDUL_SI_LADY_SMALLWOOD (`split`)
- **App ID comasat șters:** `lordul_si_lady_smallwood`
- **Nume sparte:** ['Lordul Smallwood', 'Lady Smallwood']
- **ID-uri create noi:** `['lordul_smallwood']`
- **ID-uri existente re-utilizate/îmbogățite:** `['lady_smallwood']`

### #52. PERSON_LORDUL_WILLUM_SI_FIII_SAI_JOSIA_SI_ELYAS (`split`)
- **App ID comasat șters:** `lordul_willum_si_fiii_sai_josia_si_elyas`
- **Nume sparte:** ['Lordul Willum', 'Josia', 'Elyas']
- **ID-uri create noi:** `['josia', 'elyas']`
- **ID-uri existente re-utilizate/îmbogățite:** `['lordul_willum']`

### #53. PERSON_LYN_CORBRAY_SI_LORDUL_LYONEL_CORBRAY (`split`)
- **App ID comasat șters:** `lyn_corbray_si_lordul_lyonel_corbray`
- **Nume sparte:** ['Lyn Corbray', 'Lordul Lyonel Corbray']
- **ID-uri create noi:** `['lordul_lyonel_corbray']`
- **ID-uri existente re-utilizate/îmbogățite:** `['lyn_corbray']`

### #54. PERSON_LYRA_EDYTH (`split`)
- **App ID comasat șters:** `lyra_edyth`
- **Nume sparte:** ['Lyra', 'Edyth']
- **ID-uri create noi:** `['lyra', 'edyth']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #55. PERSON_MAESTER_BALLABAR_MAESTER_FRENKEN (`split`)
- **App ID comasat șters:** `maester_ballabar_maester_frenken`
- **Nume sparte:** ['Maester Ballabar', 'Maester Frenken']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['maester_ballabar', 'maester_frenken']`

### #56. PERSON_MAESTER_TURQUIN_MAESTER_ERRECK (`split`)
- **App ID comasat șters:** `maester_turquin_maester_erreck`
- **Nume sparte:** ['Maester Turquin', 'Maester Erreck']
- **ID-uri create noi:** `['maester_turquin', 'maester_erreck']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #57. PERSON_MARQ_PIPER_PATREK_MALLISTER (`split`)
- **App ID comasat șters:** `marq_piper_patrek_mallister`
- **Nume sparte:** ['Marq Piper', 'Patrek Mallister']
- **ID-uri create noi:** `['marq_piper']`
- **ID-uri existente re-utilizate/îmbogățite:** `['patrek_mallister']`

### #58. PERSON_MEDRICK_MANDERLY_SI_TORRHEN_MANDERLY (`split`)
- **App ID comasat șters:** `medrick_manderly_si_torrhen_manderly`
- **Nume sparte:** ['Medrick Manderly', 'Torrhen Manderly']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['medrick_manderly', 'torrhen_manderly']`

### #59. PERSON_MORRA_SI_MELLEI (`split`)
- **App ID comasat șters:** `morra_si_mellei`
- **Nume sparte:** ['Morra', 'Mellei']
- **ID-uri create noi:** `['morra', 'mellei']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #60. PERSON_MREANA_TERCI (`split`)
- **App ID comasat șters:** `mreana_terci`
- **Nume sparte:** ['Mreană', 'Terci']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['mreana', 'terci']`

### #61. PERSON_MULLY_SI_KEGS (`split`)
- **App ID comasat șters:** `mully_si_kegs`
- **Nume sparte:** ['Mully', 'Kegs']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['mully', 'kegs']`

### #62. PERSON_OSNEY_SI_OSFRYD_KETTLEBLACK (`split`)
- **App ID comasat șters:** `osney_si_osfryd_kettleblack`
- **Nume sparte:** ['Osney Kettleblack', 'Osfryd Kettleblack']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['osney_kettleblack', 'osfryd_kettleblack']`

### #63. PERSON_PRENTYS_TULLY_SI_LADY_LUCINDA (`split`)
- **App ID comasat șters:** `prentys_tully_si_lady_lucinda`
- **Nume sparte:** ['Prentys Tully', 'Lady Lucinda']
- **ID-uri create noi:** `['lady_lucinda']`
- **ID-uri existente re-utilizate/îmbogățite:** `['prentys_tully']`

### #64. PERSON_PUMN_NEGRU_CETHERYS (`split`)
- **App ID comasat șters:** `pumn_negru_cetherys`
- **Nume sparte:** ['Pumn Negru', 'Cetherys']
- **ID-uri create noi:** `['pumn_negru', 'cetherys']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #65. PERSON_QEZZA_SI_GRAZHAR (`split`)
- **App ID comasat șters:** `qezza_si_grazhar`
- **Nume sparte:** ['Qezza', 'Grazhar']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['qezza', 'grazhar']`

### #66. PERSON_QUENTYN_MARTELL_TRYSTANE_MARTELL (`split`)
- **App ID comasat șters:** `quentyn_martell_trystane_martell`
- **Nume sparte:** ['Quentyn Martell', 'Trystane Martell']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['quentyn_martell', 'trystane_martell']`

### #67. PERSON_ROBERT_GLOVER_SI_LADY_GLOVER (`split`)
- **App ID comasat șters:** `robert_glover_si_lady_glover`
- **Nume sparte:** ['Robert Glover', 'Lady Glover']
- **ID-uri create noi:** `['lady_glover']`
- **ID-uri existente re-utilizate/îmbogățite:** `['robert_glover']`

### #68. PERSON_RORGE_SI_MUSCATORUL (`split`)
- **App ID comasat șters:** `rorge_si_muscatorul`
- **Nume sparte:** ['Rorge', 'Mușcătorul']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['rorge', 'muscatorul']`

### #69. PERSON_RORY_SI_PATE (`split`)
- **App ID comasat șters:** `rory_si_pate`
- **Nume sparte:** ['Rory', 'Pate']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['rory', 'pate']`

### #70. PERSON_SER_JOFFREY_DOGGETT_SI_SER_LORENCE_ROXTON (`split`)
- **App ID comasat șters:** `ser_joffrey_doggett_si_ser_lorence_roxton`
- **Nume sparte:** ['Ser Joffrey Doggett', 'Ser Lorence Roxton']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['ser_joffrey_doggett', 'ser_lorence_roxton']`

### #71. PERSON_SER_OLYVER_BRACKEN_SI_SER_RAYMUND_MALLERY (`split`)
- **App ID comasat șters:** `ser_olyver_bracken_si_ser_raymund_mallery`
- **Nume sparte:** ['Ser Olyver Bracken', 'Ser Raymund Mallery']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['ser_olyver_bracken', 'ser_raymund_mallery']`

### #72. PERSON_SHAGGA_SI_TIMETT (`split`)
- **App ID comasat șters:** `shagga_si_timett`
- **Nume sparte:** ['Shagga', 'Timett']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['shagga', 'timett']`

### #73. PERSON_STYR_MAGNARUL_DIN_THENN (`false_positive`)
- **App ID:** `styr_magnarul_din_thenn`
- **Nume canonic setat:** `Styr`
- **Alias adăugat:** `Magnarul din Thenn`
- **Note:** O singură persoană (Styr, Magnarul Thennilor) — vezi și #74, #75, dubluri de nume/titlu ale aceleiași persoane. Personajul "styr" există deja separat.

### #74. PERSON_STYR_MAGNARUL_THENNILOR (`false_positive`)
- **App ID:** `styr_magnarul_thennilor`
- **Nume canonic setat:** `Styr`
- **Alias adăugat:** `Magnarul Thennilor`
- **Note:** Duplicat al #73 — aceeași persoană, altă formulare a titlului.

### #75. PERSON_STYR_MAGNAR_AL_THENNEI (`false_positive`)
- **App ID:** `styr_magnar_al_thennei`
- **Nume canonic setat:** `Styr`
- **Alias adăugat:** `Magnar al Thennei`
- **Note:** Duplicat al #73 — aceeași persoană, altă formulare a titlului.

### #76. PERSON_TAGGANARO_SI_CASSO (`split`)
- **App ID comasat șters:** `tagganaro_si_casso`
- **Nume sparte:** ['Tagganaro', 'Casso (Regele Focilor)']
- **ID-uri create noi:** `['tagganaro', 'casso']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #77. PERSON_TATAL_LUI_PENNY_SI_OPPO (`uncertain`)
- **App ID:** `tatal_lui_penny_si_oppo`
- **Motiv:** "Tatăl lui Penny și Oppo" — neclar dacă Oppo E tatăl lui Penny (nume de scenă) sau altă rudă (frate). Necesită verificare în text (ADWD).
- **Acțiune:** Păstrat nemodificat, adăugat în review.

### #78. PERSON_TORREK_JAGGOT (`split`)
- **App ID comasat șters:** `torrek_jaggot`
- **Nume sparte:** ['Torrek', 'Jaggot']
- **ID-uri create noi:** `['torrek', 'jaggot']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #79. PERSON_TORR_KARSTARK_EDD_KARSTARK (`split`)
- **App ID comasat șters:** `torr_karstark_edd_karstark`
- **Nume sparte:** ['Torr Karstark', 'Edd Karstark']
- **ID-uri create noi:** `['torr_karstark', 'edd_karstark']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #80. PERSON_TY_SI_DANNEL (`split`)
- **App ID comasat șters:** `ty_si_dannel`
- **Nume sparte:** ['Ty', 'Dannel']
- **ID-uri create noi:** `['ty', 'dannel']`
- **ID-uri existente re-utilizate/îmbogățite:** `[]`

### #81. PERSON_WALDER_CEL_MIC_WALDER_CEL_MARE (`split`)
- **App ID comasat șters:** `walder_cel_mic_walder_cel_mare`
- **Nume sparte:** ['Walder cel Mic', 'Walder cel Mare']
- **ID-uri create noi:** `['walder_cel_mare']`
- **ID-uri existente re-utilizate/îmbogățite:** `['walder_cel_mic']`

### #82. PERSON_WALDER_SI_WALDER (`split`)
- **App ID comasat șters:** `walder_si_walder`
- **Nume sparte:** ['Walder cel Mic', 'Walder cel Mare']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['walder_cel_mic', 'walder_cel_mare']`

### #83. PERSON_WALTON_AMABEL (`split`)
- **App ID comasat șters:** `walton_amabel`
- **Nume sparte:** ['Walton', 'Amabel']
- **ID-uri create noi:** `['amabel']`
- **ID-uri existente re-utilizate/îmbogățite:** `['walton']`

### #84. PERSON_WEESE_CHISWYCK (`split`)
- **App ID comasat șters:** `weese_chiswyck`
- **Nume sparte:** ['Weese', 'Chiswyck']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['weese', 'chiswyck']`

### #85. PERSON_WYL_HEWARD (`split`)
- **App ID comasat șters:** `wyl_heward`
- **Nume sparte:** ['Heward', 'Wyl']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['heward', 'wyl']`

### #86. PERSON_YANDRY_SI_YSILLA (`split`)
- **App ID comasat șters:** `yandry_si_ysilla`
- **Nume sparte:** ['Yandry', 'Ysilla']
- **ID-uri create noi:** `[]`
- **ID-uri existente re-utilizate/îmbogățite:** `['yandry', 'ysilla']`
