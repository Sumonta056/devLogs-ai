export const SITE = {
  title: 'The Weekly Report',
  intro: 'A Claude agent reads the news on 3 topics each week and writes a short report for each one. Pick a topic below to read all its reports.',
};

export const PROFILE = {
  name: 'Sumonta Saha Mridul',
  initials: 'SM',
  photo: 'https://avatars.githubusercontent.com/u/61287791?v=4',
  role: 'Software Engineer at Cefalo',
  bio: 'I built a Claude agent that runs every week on 3 topics I use at work: AI coding agents, Vue & Nuxt, and Java & Spring. It finds the news of the week and writes a short report for me and for you.',
  links: [
    { label: 'GitHub', icon: 'github', href: '#' },
    { label: 'LinkedIn', icon: 'linkedin', href: '#' },
    { label: 'X', icon: 'x', href: '#' },
    { label: 'Email', icon: 'mail', href: '#' },
  ],
};

export const REPORTS = [
  {
    dir: 'ai-update-weekly',
    title: 'AI Update (Agentic Dev)',
    short: 'AI Update',
    visibility: 'public',
    color: '#fcd34d', on: '#3d2e00', ink: '#8a6400',
    icon: 'sparkles',
    cadence: 'Every Sunday',
    about: "Every Sunday, my Claude agent collects the week's news on AI coding agents: new tools, real workflows, prompt tips, and the top GitHub projects.",
    tags: ['Coding agents', 'MCP', 'Prompting', 'GitHub picks'],
  },
  {
    dir: 'vue-nuxt-weekly-news',
    title: 'Vue & Nuxt Weekly News',
    short: 'Vue & Nuxt',
    visibility: 'public',
    color: '#2b8a3e', on: '#ffffff', ink: '#237032',
    icon: 'vuedotjs',
    cadence: 'Every Tuesday',
    about: 'Every Tuesday, my Claude agent collects Vue 3 and Nuxt releases, upgrade guides, and patterns, with notes on what matters for real projects.',
    tags: ['Vue 3', 'Nuxt', 'Upgrades', 'Performance'],
  },
  {
    dir: 'java-spring-weekly-news',
    title: 'Java & Spring Weekly News',
    short: 'Java & Spring',
    visibility: 'public',
    color: '#1c4fa0', on: '#ffffff', ink: '#1c4fa0',
    icon: 'openjdk',
    cadence: 'Every Thursday',
    about: 'Every Thursday, my Claude agent collects JDK and Spring Boot releases, backend practice, and performance notes for Java developers.',
    tags: ['Spring Boot', 'JDK', 'Virtual threads', 'Observability'],
  },
  {
    dir: 'personal-guide',
    title: 'Personal Guide',
    short: 'Personal',
    visibility: 'private',
    color: '#6b7280', on: '#ffffff', ink: '#4b5563',
    icon: 'newspaper',
    cadence: 'Private',
    about: 'Private notes. This page needs a login.',
    tags: [],
  },
];
