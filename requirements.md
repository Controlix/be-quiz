# Context

Met een aantal vrienden ga ik af en toe naar een quiz. Meestal verloopt dit als volgt:
- iemand ziet een melding dat er ergens een quiz zal doorgaan
- die deelt de melding in onze WhatsApp groepje
- wie kan/wil deelnemen, reageert
  - ook komen er vaak reacties van mensen om te melden dat ze niet kunnen deel te nemen
- eens we over voldoende deelnemers beschikken, schrijft iemand in
  - meestal gebeurt dit via het email adres dat vermeld staat bij de aankondiging
  - vaak gaat dit gepaard met het betalen van het inschrijvingsgeld
- we hebben ook een google kalender waar we dan de quiz in zetten
  - hierbij vermelden we de locatie, aanvangsuur, deelnemers, wie het inschrijvingsgeld betaald heeft
- vaak maken we in ons WhatsApp groepje nog afspraken wie met wie kan meerijden

# Probleem

Vaak komen er verschillende positieve en negatieve reacties op een zelfde quiz, verspreid over meerdere WhatsApp berichten. 
Hierdoor is het moeilijk een overzicht te krijgen van wie wel/niet kan.
Ook staan er meldingen voor verschillende kwissen, wat het overzicht nog moeilijker maakt.

We moeten dus ook 3 verschillende applicaties gebruiken: WhatsApp om te melden en deelnemers te vinden, email om in te schrijven, kalender om kwissen in te noteren waaraan we gaan deelnemen.

Daarom zoek ik naar een geïntegreerde oplossing.

# Idee

De applicatie die ik voor ogen heb, zou volgende flow kunnen ondersteunen:

1. iemand deelt een quiz in de app, meestal door een foto te delen die hij/zij kopieert van een Facebook pagina of website
2. de app leest automatisch titel, datum, plaats, aantal deelnemers en andere relevante informatie
3. iedereen kan aangeven of hij wel/niet kan (wil) deelnemen aan deze kwis
4. de app toont eenvoudig hoeveel kandidaat kwissers al positief reageerden en of het maximum aantal deelnemers reeds bereikt is
5. wanneer er meer kandidaten zijn dan maximum toegelaten, zet de app ze op de reservenlijst. Dit is handig wanneer iemand later moet afzeggen.
6. op elk moment kan iemand via de app de ploeg inschrijven
6. wanneer iemand het inschrijvingsgeld vooraf betaald, onthoudt de app dat
7. je kan gemakkelijk zien wie allemaal deelneemt
8. je krijgt een overzicht van welke kwissen er gepland zijn, en of we wel/niet al ingeschreven zijn

# Omgeving

Idealiter draait de app op smartphone, dus zowel Android als iPhone.
Een web app is ook een optie, maar dan wel aangepast om op mobiel te gebruiken.

Integratie met mail is een must. Eventueel integratie met WhatsApp om via die weg gemakkelijk andere mensen te kunnen bereiken ook.
