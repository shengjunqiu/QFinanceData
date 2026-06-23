type PlaceholderPageProps = {
  eyebrow?: string;
  title: string;
};

export function PlaceholderPage({ eyebrow = "QFinanceData", title }: PlaceholderPageProps) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
    </section>
  );
}
