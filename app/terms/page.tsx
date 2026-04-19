import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use — Le Boutique Art',
}

export default function TermsPage() {
  return (
    <main className="pt-32 pb-24 bg-lm-bg dark:bg-dm-bg">
      <div className="max-w-3xl mx-auto px-6 lg:px-12">

        <div className="mb-16 border-b border-lm-border dark:border-dm-border pb-10">
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">Legal</p>
          <h1 className="font-serif text-5xl md:text-6xl text-lm-text dark:text-dm-text">Terms of Use</h1>
        </div>

        <div className="prose prose-sm max-w-none text-lm-muted dark:text-dm-muted leading-relaxed space-y-8">

          <p>
            The following Terms of Use (&ldquo;Terms&rdquo;) govern your use of the{' '}
            <span className="text-lm-text dark:text-dm-text">http://www.leboutiqueart.com</span>{' '}
            web site and social media sites controlled by Le Boutique Art and/or its subsidiaries and affiliated entities
            (&ldquo;Le Boutique Art&rdquo;) (collectively, the &ldquo;Web Site&rdquo;). Please read this document carefully
            because by accessing or using the Web Site you agree to be bound by these terms and conditions. If you do not
            agree to these Terms, please do not use the Web Site.
          </p>

          <div>
            <h2 className="font-serif text-xl text-lm-text dark:text-dm-text mb-3">User Conduct</h2>
            <p>
              By accessing and using the Web Site, you agree: (i) that you will comply with all applicable local, state,
              national, and international laws and regulations that govern your use of the Web Site; (ii) not to disrupt or
              interfere with the security or accessibility of the Web Site or any services offered in connection with the
              Web Site; (iii) not to transmit any obscene or otherwise offensive content, viruses or other harmful files,
              or any type of unsolicited mass email through or in connection with the Web Site; (iv) to provide truthful
              and accurate information about your identity if you choose to register on the Web Site; and (v) not to
              attempt to gain unauthorized access to the Web Site.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl text-lm-text dark:text-dm-text mb-3">Ownership of Intellectual Property</h2>
            <p>
              All content published on the Web Site (the &ldquo;Contents&rdquo;) is protected by applicable intellectual
              property laws and is owned or licensed by Le Boutique Art. Le Boutique Art grants you a limited right to
              access and use the Web Site. You may not modify, create a derivative work, display, distribute, perform
              publicly, or in any way exploit, in whole or in part, any of the Contents or software contained on, or
              comprising, the Web Site without seeking prior written permission from Le Boutique Art. You are also
              restricted from using any automated device or manual process to copy, monitor, index or data mine the Web
              Site. Le Boutique Art, its respective logos, trade dress, and the graphics and layout of the Web Site are
              the registered and/or unregistered service marks, trademarks, and/or trade dress of Le Boutique Art and may
              not be copied, imitated or used, in whole or in part, without Le Boutique Art&apos;s prior written
              permission. All other copyrighted images, trademarks, product names, and company names or logos mentioned on
              the Web Site are the property of their respective owners.
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}
