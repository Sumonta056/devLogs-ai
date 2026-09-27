export const SITE = {
  title: 'The Weekly Report',
  intro: 'Weekly notes on the tools I use at work. Pick a newsletter below to see all its issues.',
};

export const PROFILE = {
  name: 'Sumonta Saha Mridul',
  initials: 'SM',
  photo: 'https://avatars.githubusercontent.com/u/61287791?v=4',
  role: 'Software Engineer at Cefalo',
  bio: 'My Claude write short weekly notes on the tools I use at work: AI coding agents, Vue & Nuxt, and Java & Spring. Each issue is what I learned that week.',
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
    about: 'Weekly notes on AI coding agents: new tools, real workflows, prompt tips, and the most-starred GitHub projects of the week.',
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
    about: 'Releases, upgrade guides, and patterns for Vue 3 and Nuxt, with notes on what matters for real projects.',
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
    about: 'JDK and Spring Boot releases, backend practice, and performance notes for Java developers.',
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
