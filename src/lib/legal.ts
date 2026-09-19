export interface LegalSection {
  id: string;
  title: string;
  body: string[];
}

export interface LegalDoc {
  key: string;
  slug: string;
  icon: string;
  title: string;
  short: string;
  version: string;
  published: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT = [
  "Téléphone : 037 63 244 15",
  "Email : all.in.one.mada.store@gmail.com",
  "WhatsApp : +86 130 2511 0873",
];

export const LEGAL_DOCS: LegalDoc[] = [
  {
    key: "cgu",
    slug: "cgu",
    icon: "📄",
    title: "Conditions Générales d'Utilisation",
    short: "CGU",
    version: "1.0",
    published: "2026-09-18",
    updated: "2026-09-18",
    intro:
      "Les présentes Conditions Générales d'Utilisation (CGU) encadrent l'accès et l'utilisation de la plateforme ALL IN ONE MADA STORE. En créant un compte, vous déclarez les avoir lues et acceptées.",
    sections: [
      {
        id: "presentation",
        title: "1. Présentation de la plateforme",
        body: [
          "ALL IN ONE MADA STORE est une marketplace en ligne destinée au marché malgache. Elle met en relation des vendeurs indépendants et des clients, et fournit les outils techniques nécessaires à cette mise en relation : catalogue produits, messagerie, portefeuille interne, suivi de livraison et support.",
          "ALL IN ONE MADA STORE n'est pas le vendeur des produits proposés, sauf mention explicite contraire sur une fiche produit. Chaque vendeur reste responsable des produits qu'il publie et vend.",
        ],
      },
      {
        id: "objet",
        title: "2. Objet",
        body: [
          "Les CGU définissent les règles d'accès, de navigation et d'utilisation des services de la plateforme, ainsi que les droits et obligations respectifs des utilisateurs, des vendeurs et de la plateforme.",
        ],
      },
      {
        id: "inscription",
        title: "3. Conditions d'inscription",
        body: [
          "L'accès aux fonctionnalités de la marketplace nécessite la création d'un compte. L'utilisateur doit disposer de la capacité juridique requise pour contracter et, s'il est mineur, agir avec l'accord de son représentant légal.",
          "L'inscription suppose l'acceptation préalable des CGU, des CGV et la prise de connaissance de la Politique de Confidentialité.",
        ],
      },
      {
        id: "compte",
        title: "4. Création et sécurité du compte",
        body: [
          "L'utilisateur choisit un mot de passe personnel qu'il s'engage à garder confidentiel. Toute action réalisée depuis le compte est présumée effectuée par son titulaire.",
          "En cas de suspicion d'accès non autorisé, l'utilisateur doit changer son mot de passe et prévenir immédiatement la plateforme.",
        ],
      },
      {
        id: "exactitude",
        title: "5. Exactitude des informations",
        body: [
          "L'utilisateur s'engage à fournir des informations exactes, complètes et à jour (identité, téléphone, email, adresse de livraison) et à les corriger en cas de changement. Des informations erronées peuvent empêcher la livraison ou le traitement d'une commande.",
        ],
      },
      {
        id: "clients",
        title: "6. Règles applicables aux clients",
        body: [
          "Le client s'engage à utiliser la plateforme de bonne foi : commandes sincères, communication respectueuse avec les vendeurs, réception et confirmation des colis dans des délais raisonnables.",
          "Sont interdits : les commandes frauduleuses, les fausses réclamations, l'usage de moyens de paiement non autorisés et toute tentative de contournement du système de paiement interne.",
        ],
      },
      {
        id: "vendeurs",
        title: "7. Règles applicables aux vendeurs",
        body: [
          "Le vendeur s'engage à publier des produits qu'il détient réellement ou qu'il est en mesure de fournir, à maintenir son stock et ses prix à jour, à préparer et expédier les commandes dans les délais annoncés et à assurer un service après-vente correct.",
          "Le vendeur est responsable de la conformité, de la légalité et de la description de ses produits, ainsi que du respect de ses propres obligations fiscales et réglementaires.",
        ],
      },
      {
        id: "produits",
        title: "8. Produits publiés",
        body: [
          "Chaque fiche produit doit comporter un titre clair, une description fidèle, un prix en Ariary (MGA), des photos réelles du produit et, le cas échéant, les variantes disponibles.",
          "Sont strictement interdits les produits illégaux, dangereux, frauduleux, volés, contrefaits, ainsi que tout produit dont la vente est soumise à une autorisation dont le vendeur ne dispose pas.",
        ],
      },
      {
        id: "contenus",
        title: "9. Photos, vidéos, descriptions et contenus",
        body: [
          "L'utilisateur garantit détenir les droits sur les contenus qu'il publie. Les contenus trompeurs, offensants, violents, sexuellement explicites ou portant atteinte aux droits d'un tiers sont interdits.",
          "La plateforme peut retirer, sans préavis, tout contenu manifestement contraire aux présentes règles ou à la loi.",
        ],
      },
      {
        id: "messagerie",
        title: "10. Messagerie et chat",
        body: [
          "La messagerie sert exclusivement aux échanges liés aux produits et aux commandes. Le harcèlement, le spam, les arnaques et les tentatives de transaction hors plateforme y sont interdits.",
          "Les messages peuvent être consultés par la plateforme dans le cadre d'un litige, d'une réclamation ou d'une enquête de sécurité.",
        ],
      },
      {
        id: "avis",
        title: "11. Avis, commentaires, likes et interactions",
        body: [
          "Les avis doivent refléter une expérience réelle. Les faux avis, les avis achetés et les propos diffamatoires peuvent être supprimés et entraîner des sanctions.",
        ],
      },
      {
        id: "notifications",
        title: "12. Notifications",
        body: [
          "La plateforme envoie des notifications liées aux commandes, aux messages, au portefeuille et au support. Certaines notifications de service sont indispensables au fonctionnement du compte et ne peuvent pas être désactivées.",
        ],
      },
      {
        id: "ia",
        title: "13. Intelligence artificielle et recommandations",
        body: [
          "La plateforme utilise des outils d'intelligence artificielle pour aider à la rédaction des fiches produits, la catégorisation, la recherche par image, l'assistance support et la personnalisation des recommandations.",
          "Ces outils fournissent une aide indicative. Ils n'ont aucun pouvoir décisionnel juridique : les décisions importantes (suspension, litige, remboursement) font l'objet d'une intervention humaine.",
        ],
      },
      {
        id: "promotions",
        title: "14. Promotions et coupons",
        body: [
          "Les promotions et coupons sont attribués selon des règles pouvant évoluer. Ils sont personnels, non cessibles, non échangeables contre de l'argent et valables jusqu'à leur date d'expiration.",
          "Tout usage abusif (multiplication de comptes, fraude) entraîne l'annulation des avantages.",
        ],
      },
      {
        id: "securite",
        title: "15. Sécurité et sanctions",
        body: [
          "En cas de violation des présentes règles, de fraude avérée ou de risque pour les autres utilisateurs, la plateforme peut limiter, suspendre ou fermer un compte, retirer des annonces et bloquer temporairement des fonds liés à une opération litigieuse, dans le respect des droits de l'utilisateur concerné.",
          "L'utilisateur est informé de la mesure et peut la contester via le support.",
        ],
      },
      {
        id: "pi",
        title: "16. Propriété intellectuelle",
        body: [
          "La marque, le design, les textes et le code de la plateforme appartiennent à ALL IN ONE MADA STORE. Les contenus publiés par les vendeurs restent leur propriété ; ils concèdent à la plateforme une licence d'affichage et de promotion limitée à l'exploitation du service.",
        ],
      },
      {
        id: "responsabilites",
        title: "17. Responsabilités",
        body: [
          "Le vendeur est responsable du produit vendu, de sa conformité, de son emballage et de son expédition. Le client est responsable de l'exactitude de ses informations et du bon usage de son compte.",
          "La plateforme est responsable du fonctionnement technique du service et de la bonne exécution des opérations qu'elle réalise elle-même (portefeuille interne, transmission des commandes, médiation). Elle ne peut garantir une disponibilité ininterrompue du service.",
        ],
      },
      {
        id: "modification",
        title: "18. Modification des CGU",
        body: [
          "Les CGU peuvent être modifiées. Chaque modification donne lieu à une nouvelle version numérotée et datée. Les utilisateurs sont informés des modifications importantes et une nouvelle acceptation peut être demandée lorsque cela est nécessaire.",
        ],
      },
      {
        id: "litiges",
        title: "19. Réclamations et litiges",
        body: [
          "Toute réclamation peut être déposée via le Centre d'aide de l'application ou par les coordonnées ci-dessous. La plateforme s'efforce d'apporter une réponse dans un délai raisonnable et propose une médiation entre client et vendeur.",
          "À défaut de solution amiable, les parties conservent l'intégralité de leurs droits légaux devant les juridictions compétentes à Madagascar.",
        ],
      },
      { id: "contact", title: "20. Contact", body: CONTACT },
    ],
  },
  {
    key: "cgv",
    slug: "cgv",
    icon: "🧾",
    title: "Conditions Générales de Vente",
    short: "CGV",
    version: "1.0",
    published: "2026-09-18",
    updated: "2026-09-18",
    intro:
      "Les présentes Conditions Générales de Vente (CGV) encadrent les ventes conclues entre un vendeur inscrit sur ALL IN ONE MADA STORE et un client, via la plateforme.",
    sections: [
      {
        id: "commande",
        title: "1. Processus de commande",
        body: [
          "Le client sélectionne un produit, choisit la ou les variantes proposées et la quantité souhaitée, renseigne son adresse de livraison, puis valide sa commande après affichage du récapitulatif (prix, remises, frais de livraison, total).",
          "La commande est ferme une fois validée et payée depuis le portefeuille interne.",
        ],
      },
      {
        id: "produits",
        title: "2. Informations sur les produits",
        body: [
          "Les caractéristiques essentielles des produits sont décrites par le vendeur. Les photos ont une valeur illustrative ; de légères différences (nuance de couleur, finition) peuvent exister sans constituer une non-conformité.",
        ],
      },
      {
        id: "prix",
        title: "3. Prix, promotions et coupons",
        body: [
          "Les prix sont affichés en Ariary (MGA). Un prix indicatif en USDT peut être affiché à titre informatif selon un taux de conversion interne.",
          "Les prix promotionnels sont valables pendant la durée indiquée et dans la limite des stocks. Les coupons attribués au client sont appliqués automatiquement lorsqu'ils sont éligibles au panier concerné.",
          "Les remises automatiques éventuelles (par exemple remise quantité) sont affichées avant validation.",
        ],
      },
      {
        id: "stock",
        title: "4. Disponibilité et stock",
        body: [
          "Les produits sont proposés dans la limite du stock déclaré par le vendeur. En cas d'indisponibilité constatée après commande, la commande est annulée et le montant est restitué au portefeuille du client.",
        ],
      },
      {
        id: "livraison-frais",
        title: "5. Frais et adresse de livraison",
        body: [
          "Les frais de livraison sont calculés selon la zone de livraison et l'adresse renseignée par le client. Ils sont affichés avant la validation de la commande.",
          "Le client est responsable de l'exactitude de l'adresse fournie. Une adresse incorrecte peut entraîner des frais supplémentaires ou l'échec de la livraison.",
        ],
      },
      {
        id: "paiement",
        title: "6. Paiement",
        body: [
          "Le paiement s'effectue exclusivement via le portefeuille interne de la plateforme, alimenté par dépôt avec justificatif. Le montant est débité à la validation de la commande.",
          "La part revenant au vendeur est conservée en attente jusqu'à la confirmation de réception ou l'expiration du délai de libération automatique.",
        ],
      },
      {
        id: "traitement",
        title: "7. Validation, préparation et expédition",
        body: [
          "Après validation, le vendeur prépare le colis et le remet au mode d'acheminement indiqué. Le client suit l'évolution de sa commande depuis la page de suivi (préparation, expédition, transit, arrivée, livraison).",
        ],
      },
      {
        id: "reception",
        title: "8. Réception et confirmation",
        body: [
          "À la réception, le client vérifie le colis et confirme la réception dans l'application. Cette confirmation déclenche la libération des fonds au vendeur.",
          "En l'absence de confirmation et de réclamation dans le délai de libération automatique affiché, les fonds peuvent être libérés automatiquement. Ce mécanisme ne prive pas le client de ses droits en cas de produit non reçu, défectueux ou non conforme.",
        ],
      },
      {
        id: "annulation",
        title: "9. Annulation",
        body: [
          "Une commande peut être annulée tant qu'elle n'a pas été expédiée, sur demande du client ou en cas d'indisponibilité. Le montant payé est alors restitué au portefeuille du client.",
        ],
      },
      {
        id: "retours",
        title: "10. Retours et remboursements",
        body: [
          "En cas de produit non reçu, incorrect, endommagé ou non conforme à la description, le client ouvre une réclamation depuis la commande concernée, avec photos si possible.",
          "Selon l'issue de l'examen, la solution peut être : renvoi du produit, remplacement, remboursement partiel ou remboursement total sur le portefeuille du client.",
          "Les produits périssables, d'hygiène descellés, ou personnalisés peuvent ne pas être repris, sauf défaut avéré.",
        ],
      },
      {
        id: "garanties",
        title: "11. Garanties",
        body: [
          "Les garanties légales applicables au produit vendu bénéficient au client et ne sont en aucun cas supprimées par les présentes CGV. Une garantie commerciale supplémentaire peut être proposée par le vendeur ; elle est alors précisée sur la fiche produit.",
        ],
      },
      {
        id: "mediation",
        title: "12. Litiges et médiation",
        body: [
          "En cas de désaccord entre client et vendeur, la plateforme intervient en médiateur : elle examine les échanges, les preuves fournies et l'historique de la commande, et propose une solution.",
          "La plateforme n'est pas juge : à défaut d'accord, les parties conservent leurs droits légaux.",
        ],
      },
      {
        id: "specifiques",
        title: "13. Produits sur commande et personnalisés",
        body: [
          "Pour les produits fabriqués ou importés sur commande, le délai annoncé par le vendeur est indicatif et doit être clairement affiché avant achat. Un acompte ou un paiement intégral peut être exigé.",
          "Les produits personnalisés (gravure, taille spécifique, impression) ne sont pas repris sauf erreur du vendeur ou défaut.",
        ],
      },
      { id: "contact", title: "14. Contact", body: CONTACT },
    ],
  },
  {
    key: "confidentialite",
    slug: "confidentialite",
    icon: "🔐",
    title: "Politique de Confidentialité",
    short: "Confidentialité",
    version: "1.0",
    published: "2026-09-18",
    updated: "2026-09-18",
    intro:
      "Cette politique explique quelles données personnelles ALL IN ONE MADA STORE collecte, pourquoi, comment elles sont utilisées, qui peut y accéder et comment exercer vos droits.",
    sections: [
      {
        id: "donnees",
        title: "1. Données collectées",
        body: [
          "Identité et contact : nom, prénom, numéro de téléphone, adresse email.",
          "Livraison : adresse de livraison, quartier, ville, région, coordonnées de localisation nécessaires au calcul des frais et à l'acheminement.",
          "Compte : identifiants, rôle (client, vendeur), préférences d'affichage.",
          "Activité d'achat : historique des commandes, panier, favoris, produits consultés, historique de recherche.",
          "Communication : messages échangés, tickets de support, avis et commentaires.",
          "Paiement interne : solde du portefeuille, opérations, preuves de dépôt et références de paiement lorsque nécessaires.",
          "Données vendeur : nom de boutique, téléphone, adresse de retrait, informations de retrait de fonds.",
          "Données techniques et de sécurité : journaux de connexion, informations d'appareil et de navigation nécessaires au fonctionnement, à la sécurité et à la prévention de la fraude.",
        ],
      },
      {
        id: "finalites",
        title: "2. Pourquoi ces données sont collectées",
        body: [
          "Créer et gérer votre compte et votre rôle sur la plateforme.",
          "Traiter les commandes, calculer les frais de livraison et permettre l'acheminement des colis.",
          "Faire fonctionner le portefeuille interne, vérifier les dépôts et traiter les retraits.",
          "Assurer le support client, traiter les réclamations et arbitrer les litiges.",
          "Assurer la sécurité des comptes et prévenir la fraude et les abus.",
          "Améliorer le service et personnaliser les recommandations de produits.",
        ],
      },
      {
        id: "acces",
        title: "3. Qui peut accéder aux données",
        body: [
          "Vous-même, depuis votre compte.",
          "Le vendeur concerné, uniquement pour les informations nécessaires à l'exécution de votre commande (nom, téléphone, adresse de livraison, contenu de la commande).",
          "L'équipe d'administration de la plateforme, dans la limite de ce qui est nécessaire au support, à la sécurité et à la gestion des litiges.",
          "Les prestataires techniques strictement nécessaires au fonctionnement du service (hébergement, envoi de notifications, outils d'intelligence artificielle), dans le cadre de leur mission.",
          "Vos données ne sont pas vendues à des tiers.",
        ],
      },
      {
        id: "conservation",
        title: "4. Durée de conservation",
        body: [
          "Données de compte : conservées tant que le compte est actif.",
          "Commandes, opérations de portefeuille et preuves de paiement : conservées après la transaction pour les besoins de preuve, de comptabilité et de gestion des litiges.",
          "Messages et tickets : conservés le temps nécessaire au suivi de la relation et des litiges.",
          "Données de navigation et de recommandation : conservées pour une durée limitée puis agrégées ou supprimées.",
        ],
      },
      {
        id: "suppression",
        title: "5. Suppression",
        body: [
          "Vous pouvez demander la suppression de votre compte. Certaines données peuvent devoir être conservées lorsqu'une obligation légale, comptable ou un litige en cours l'impose ; elles sont alors limitées à ce strict nécessaire.",
        ],
      },
      {
        id: "droits",
        title: "6. Vos droits",
        body: [
          "Droit d'information sur l'utilisation de vos données.",
          "Droit d'accès à vos données.",
          "Droit de rectification des données inexactes.",
          "Droit d'opposition lorsque cela est applicable, notamment pour la personnalisation.",
          "Droit à la suppression lorsque cela est légalement possible.",
          "Droit de nous contacter pour toute demande relative à vos données : all.in.one.mada.store@gmail.com.",
        ],
      },
      {
        id: "ia",
        title: "7. Données et intelligence artificielle",
        body: [
          "Certaines données comportementales sont utilisées pour améliorer votre expérience : produits consultés, recherches effectuées, catégories consultées, favoris, achats et interactions avec les produits.",
          "Ces données servent principalement à personnaliser le fil de produits, à affiner les recommandations et à proposer des avantages adaptés.",
          "Les outils d'intelligence artificielle utilisés par la plateforme ont un rôle d'assistance. Ils ne prennent aucune décision juridique ou définitive concernant un utilisateur ; toute mesure importante est validée par une personne.",
          "Vous pouvez demander à limiter la personnalisation en nous contactant.",
        ],
      },
      {
        id: "securite",
        title: "8. Sécurité",
        body: [
          "L'accès aux données est protégé par une authentification obligatoire et des règles d'accès par rôle. Les informations sensibles liées aux connexions externes sont chiffrées. Aucun système n'étant infaillible, nous vous invitons à protéger votre mot de passe.",
        ],
      },
      { id: "contact", title: "9. Contact", body: CONTACT },
    ],
  },
  {
    key: "livraison",
    slug: "livraison",
    icon: "🚚",
    title: "Politique Livraison, Retours et Remboursements",
    short: "Livraison & retours",
    version: "1.0",
    published: "2026-09-18",
    updated: "2026-09-18",
    intro:
      "Cette politique précise le fonctionnement des livraisons, des retours et des remboursements sur ALL IN ONE MADA STORE. Elle complète les CGV et ne réduit pas vos droits légaux.",
    sections: [
      {
        id: "frais",
        title: "1. Frais de livraison",
        body: [
          "Les frais dépendent de la zone de livraison définie par le vendeur et de l'adresse du client. Ils sont affichés avant la validation de la commande. Le vendeur peut ajuster ces frais en cas d'erreur manifeste, la différence étant régularisée sur le portefeuille du client.",
        ],
      },
      {
        id: "delais",
        title: "2. Délais estimatifs",
        body: [
          "Les délais affichés (date de départ, fourchette de jours, date d'arrivée estimée) sont indicatifs. Ils peuvent varier selon la zone, la météo, l'état des routes et la disponibilité des transporteurs.",
        ],
      },
      {
        id: "responsabilites",
        title: "3. Responsabilités",
        body: [
          "Le vendeur est responsable de la préparation, de l'emballage, de la remise du colis et des informations de suivi qu'il renseigne.",
          "Lorsqu'un transporteur ou une coopérative intervient, l'acheminement relève de ce prestataire ; le vendeur reste l'interlocuteur du client et doit l'accompagner dans la réclamation.",
        ],
      },
      {
        id: "suivi",
        title: "4. Suivi du colis",
        body: [
          "Chaque commande dispose d'une page de suivi indiquant l'étape en cours et, lorsque disponible, un code de suivi et le nom du transporteur.",
        ],
      },
      {
        id: "reception",
        title: "5. Réception",
        body: [
          "Le client vérifie l'état du colis à la réception et confirme la réception dans l'application. En cas d'anomalie visible, il est recommandé de photographier le colis avant ouverture complète.",
        ],
      },
      {
        id: "problemes",
        title: "6. Colis perdu, endommagé, produit incorrect ou non conforme",
        body: [
          "Ouvrez une réclamation depuis la commande concernée, en décrivant le problème et en joignant des photos.",
          "La plateforme examine la réclamation avec le vendeur. Les fonds liés à la commande peuvent être maintenus en attente jusqu'à résolution.",
        ],
      },
      {
        id: "retour",
        title: "7. Retour",
        body: [
          "Lorsqu'un retour est accepté, les modalités (adresse, délai, prise en charge des frais) sont convenues via la médiation. Le produit doit être renvoyé dans un état permettant sa réexpédition, sauf s'il est défectueux.",
        ],
      },
      {
        id: "remboursement",
        title: "8. Remboursement",
        body: [
          "Le remboursement est effectué sur le portefeuille interne du client, partiellement ou totalement selon la solution retenue. Le solde du portefeuille peut ensuite être utilisé pour une nouvelle commande ou faire l'objet d'une demande de retrait selon les règles applicables.",
        ],
      },
      {
        id: "litiges",
        title: "9. Traitement des litiges",
        body: [
          "La plateforme traite les réclamations dans un délai raisonnable, sur la base des échanges, des preuves et de l'historique de la commande. À défaut d'accord amiable, les parties conservent leurs droits légaux.",
        ],
      },
      { id: "contact", title: "10. Contact", body: CONTACT },
    ],
  },
  {
    key: "cookies",
    slug: "cookies",
    icon: "🍪",
    title: "Cookies et technologies similaires",
    short: "Cookies",
    version: "1.0",
    published: "2026-09-18",
    updated: "2026-09-18",
    intro:
      "ALL IN ONE MADA STORE utilise un nombre limité de technologies de stockage local, nécessaires au fonctionnement du service.",
    sections: [
      {
        id: "usage",
        title: "1. Ce que nous utilisons",
        body: [
          "Stockage de session : conserve votre connexion pour éviter de vous authentifier à chaque page.",
          "Préférences : thème d'affichage (sombre, clair, système).",
          "Panier : conservation temporaire des produits sélectionnés.",
          "Sécurité : éléments techniques nécessaires à la protection du compte.",
        ],
      },
      {
        id: "publicite",
        title: "2. Publicité et traçage tiers",
        body: [
          "La plateforme n'utilise pas de cookies publicitaires tiers. La personnalisation des recommandations repose sur votre activité au sein de la plateforme, décrite dans la Politique de Confidentialité.",
        ],
      },
      {
        id: "gestion",
        title: "3. Gestion",
        body: [
          "Vous pouvez effacer le stockage local depuis les paramètres de votre navigateur. La suppression des éléments strictement nécessaires vous déconnectera et videra votre panier.",
        ],
      },
      { id: "contact", title: "4. Contact", body: CONTACT },
    ],
  },
  {
    key: "vendeur",
    slug: "vendeur",
    icon: "🏪",
    title: "Conditions Vendeur / Marketplace",
    short: "Conditions vendeur",
    version: "1.0",
    published: "2026-09-18",
    updated: "2026-09-18",
    intro:
      "Ces conditions s'appliquent à tout utilisateur exerçant une activité de vente sur ALL IN ONE MADA STORE. Elles complètent les CGU et les CGV.",
    sections: [
      {
        id: "publication",
        title: "1. Publication des produits",
        body: [
          "Le vendeur publie uniquement des produits qu'il peut réellement fournir. Chaque fiche comporte un titre fidèle, une description complète, des photos réelles et les variantes disponibles.",
          "L'usage d'images ne correspondant pas au produit réellement expédié est interdit.",
        ],
      },
      {
        id: "prix-stock",
        title: "2. Prix, stock et promotions",
        body: [
          "Les prix affichés en Ariary doivent être exacts et inclure ce qui est annoncé. Le stock doit être mis à jour. Les promotions annoncées doivent être réelles : afficher un prix barré fictif est interdit.",
        ],
      },
      {
        id: "commandes",
        title: "3. Commandes, préparation et livraison",
        body: [
          "Le vendeur traite les commandes dans les délais annoncés, emballe correctement les produits, renseigne les informations d'expédition et de suivi, et maintient le client informé en cas de retard.",
        ],
      },
      {
        id: "sav",
        title: "4. Service après-vente, retours et remboursements",
        body: [
          "Le vendeur répond aux messages des clients dans un délai raisonnable, traite les réclamations de bonne foi et accepte les retours et remboursements lorsque le produit est non conforme, défectueux, incorrect ou non reçu.",
        ],
      },
      {
        id: "interdits",
        title: "5. Produits interdits",
        body: [
          "Sont interdits notamment : produits illégaux, contrefaçons, produits volés, armes, substances réglementées, produits dangereux, médicaments et tout produit soumis à une autorisation dont le vendeur ne dispose pas.",
        ],
      },
      {
        id: "commissions",
        title: "6. Commissions marketplace",
        body: [
          "Une commission est prélevée par la plateforme sur chaque vente. Son taux est affiché dans l'espace vendeur et peut évoluer ; toute évolution est annoncée avant application.",
        ],
      },
      {
        id: "wallet",
        title: "7. Portefeuille vendeur et retraits",
        body: [
          "Le produit d'une vente est d'abord placé en attente. Il devient retirable après confirmation de réception par le client ou après le délai de libération automatique, en l'absence de litige.",
          "Les retraits sont demandés depuis l'espace vendeur et validés par l'administration. Les informations de retrait doivent être exactes ; la plateforme n'est pas responsable d'un virement effectué vers des coordonnées erronées fournies par le vendeur.",
        ],
      },
      {
        id: "sanctions",
        title: "8. Sanctions",
        body: [
          "En cas de fraude, de produits interdits, de fausses annonces, de non-expédition répétée ou de refus abusif de traiter les réclamations, la plateforme peut retirer des annonces, suspendre la boutique, retenir les fonds liés aux opérations litigieuses et fermer le compte vendeur.",
          "Le vendeur est informé de la mesure et peut la contester via le support.",
        ],
      },
      { id: "contact", title: "9. Contact", body: CONTACT },
    ],
  },
];

export const LEGAL_BY_SLUG: Record<string, LegalDoc> = Object.fromEntries(
  LEGAL_DOCS.map((d) => [d.slug, d]),
);

export const SIGNUP_REQUIRED = ["cgu", "cgv", "confidentialite"] as const;

export function docVersion(key: string): string {
  return LEGAL_DOCS.find((d) => d.key === key)?.version ?? "1.0";
}

export function formatLegalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const LEGAL_REVIEW_NOTICE =
  "Note interne : ces documents constituent une base rédigée pour une marketplace opérant à Madagascar. Ils doivent être relus et validés par un conseil juridique avant le lancement commercial définitif.";
