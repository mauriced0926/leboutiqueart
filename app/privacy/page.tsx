import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Le Boutique Art',
}

export default function PrivacyPage() {
  return (
    <main className="pt-32 pb-24 bg-lm-bg dark:bg-dm-bg">
      <div className="max-w-3xl mx-auto px-6 lg:px-12">

        <div className="mb-16 border-b border-lm-border dark:border-dm-border pb-10">
          <p className="text-[10px] tracking-ultra uppercase text-lm-muted dark:text-dm-muted mb-4">Legal</p>
          <h1 className="font-serif text-5xl md:text-6xl text-lm-text dark:text-dm-text">Privacy Policy</h1>
        </div>

        <div className="prose prose-sm max-w-none text-lm-muted dark:text-dm-muted leading-relaxed space-y-8">

          <p>
            If you choose to provide Le Boutique Art with personal information about yourself, Le Boutique Art will
            handle your information according to the terms of its Privacy Policy, provided separately.
          </p>

          <div>
            <h2 className="font-serif text-xl text-lm-text dark:text-dm-text mb-3">Linking</h2>
            <p>
              You are granted a limited, revocable, non-exclusive right to create a hyperlink to the Web Sites on the
              condition that the link does not portray Le Boutique Art in a false, misleading, derogatory or otherwise
              defamatory manner.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl text-lm-text dark:text-dm-text mb-3">Indemnification / Disclaimer of Warranties and Liability</h2>
            <p>
              The Web Site may contain links to web sites owned or operated by non-affiliated third parties. Please be
              aware that Le Boutique Art is not responsible for the content provided by or privacy practices of third
              party web sites. Le Boutique Art encourages users to be aware when they leave our Web Sites and to read the
              Terms of Use of the other web sites you visit.
            </p>
            <p className="mt-4">
              You agree to indemnify and hold Le Boutique Art, its subsidiaries, affiliated companies, officers, agents,
              employees, partners and licensors harmless from any claim or demand, including reasonable attorneys&apos;
              fees, made by any third party due to or arising out of content you submit, post, transmit or otherwise make
              available through the Web Site, your access or use of the Web Site, your violation of these Terms, or your
              violation of any rights of a third party.
            </p>
            <p className="mt-4 uppercase text-xs leading-relaxed">
              YOU EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE WEB SITE IS AT YOUR SOLE RISK. THE WEB SITE ARE
              PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS
              OR IMPLIED. LE BOUTIQUE ART DISCLAIMS ALL WARRANTIES WITH REGARD TO THE INFORMATION PROVIDED BY THE WEB
              SITE, INCLUDING ALL IMPLIED WARRANTIES AND CONDITIONS OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              TITLE AND NON-INFRINGEMENT. LE BOUTIQUE ART PROVIDES NO WARRANTY WITH RESPECT TO THE AVAILABILITY,
              ACCURACY, COMPLETENESS, TIMELINESS, FUNCTIONALITY, OR RELIABILITY OF THE WEB SITE OR THE CONTENT PROVIDED
              THEREON. YOU EXPRESSLY UNDERSTAND AND AGREE THAT IN NO EVENT SHALL LE BOUTIQUE ART BE LIABLE FOR ANY
              DAMAGES, INCLUDING, WITHOUT LIMITATION, SPECIAL, DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, PUNITIVE,
              LOST PROFITS OR OTHER DAMAGES ARISING FROM OR IN CONNECTION WITH THE USE, INABILITY TO USE, OR LOSS OF THE
              DATA CONTAINED WITHIN THE WEB SITE. IN STATES THAT DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN
              CATEGORIES OF DAMAGES, LE BOUTIQUE ART&apos;S LIABILITY IS LIMITED TO THE FULLEST EXTENT PERMITTED BY LAW.
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}
